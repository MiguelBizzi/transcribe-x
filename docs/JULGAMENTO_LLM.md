# Juiz LLM: fundamentação, decisões de design e limitações

Este documento descreve como o pipeline usa um LLM como juiz, por que o juiz foi desenhado assim e o que ele **não** garante. Complementa [`AVALIACAO_PIPELINE.md`](AVALIACAO_PIPELINE.md), que traz os resultados.

## 1. Papel do juiz no pipeline

O juiz aparece em dois lugares, com tarefas diferentes:

| Uso | Tarefa | Onde roda | Prompt (versão) |
|---|---|---|---|
| **Curadoria absoluta** | Nota de 0 a 10 para *coerência*, *riqueza* e *factualidade aparente* de um trecho, com justificativa por critério | `backend/scripts/llm_curator.py` (`judge_chunk`, `aggregate_runs`), chamado por `backend/src/services/llm-curation-service.ts` | `CURATION_SYSTEM_PROMPT`, versão `curation-v2` |
| **Comparação pareada** | Dado o trecho bruto e o processado (cegos, em ordem A/B), escolher o melhor para dataset de treino, ou empate | `backend/scripts/evaluate_pipeline.py` (`judge`, `resolve_swapped`) | `PAIRWISE_SYSTEM_PROMPT`, versão `pairwise-v2` |

Os prompts e as versões ficam em `backend/scripts/judge_prompts.py` (`CURATION_PROMPT_VERSION`, `PAIRWISE_PROMPT_VERSION`). A versão é gravada junto de cada nota (`promptVersion`), para que lotes avaliados com prompts diferentes não sejam misturados.

## 2. Rastreabilidade: requisito, decisão, código, literatura

| Requisito (A–F) | Decisão de design | Onde no código | Base na literatura |
|---|---|---|---|
| **A. Consistência** | Temperatura 0 e semente fixa (`JUDGE_SEED = 42`); `N` execuções por trecho (`CURATION_JUDGE_RUNS`, 1 a 5) agregadas por média, com desvio-padrão por critério (`scoreStdDev`) | `llm_curator.py`: `judge_chunk`, `aggregate_runs`, `JUDGE_SEED`; `backend/src/lib/env.ts`: `CURATION_JUDGE_RUNS`; `backend/src/services/curation-rules.ts`: `judgeRunsForPayload` | Chiang & Lee (2023) reportam resultados estáveis a mudanças na redação da instrução e no algoritmo de amostragem. Gu et al. (2024) listam múltiplas execuções entre as estratégias de consistência (§3.1.1, §3.3.1, conforme excerto do HTML v6 obtido por ferramenta de resumo; confirmar no PDF) |
| **B. Alinhamento humano** | Rubrica de 0 a 10 com âncoras por faixa, escrita como instrução que se daria a um avaliador humano; medição explícita de concordância com rótulos humanos | `judge_prompts.py`: `_RUBRIC`; `judge_reliability.py`: `agreement_with_humans`, `cohen_kappa` | Chiang & Lee (2023): as avaliações do LLM concordam com as de avaliadores humanos especialistas quando recebem as mesmas instruções. Segundo o abstract, Gu et al. (2024) tratam, em linhas gerais, a confiabilidade do juiz como algo que exige desenho cuidadoso e padronização, e propõem métodos e um benchmark para avaliá-la |
| **C. Vieses** | (i) Troca de posição: o par é julgado nas duas ordens e a discordância vira empate; (ii) cláusulas contra recompensar tamanho, estilo formal ou posição; (iii) juiz configurável e diferente do restaurador, com aviso automático quando coincidem; (iv) trecho delimitado por tags e declarado como dado, não instrução | `evaluate_pipeline.py`: `resolve_swapped`, campo `positionConsistent`, `self_preference_warning`, `JUDGE_MODEL`; `judge_prompts.py`: seção "Bias controls", `wrap_excerpt`, `wrap_pair` | Gu et al. (2024) nomeiam vieses de posição, de verbosidade (tamanho) e de autopreferência (§2.1.4, §2.4.1, §3.2.1) e descrevem como mitigação trocar a ordem dos candidatos e tratar resultados conflitantes como empate (§3.1.1); seções conforme excerto do HTML v6 obtido por ferramenta de resumo, a confirmar no PDF |
| **D. Cobertura** | Três critérios definidos, cada um com âncoras próprias: coerência, riqueza, factualidade aparente | `judge_prompts.py`: `CRITERIA`, `_RUBRIC` | Segundo o abstract, Gu et al. (2024) abordam, em linhas gerais, estratégias para adaptar o juiz a diferentes cenários de avaliação |
| **E. Justificativa** | O modelo escreve a justificativa de cada critério **antes** da nota (`criteriaRationale`); no pareado, a razão vem antes do vencedor | `judge_prompts.py`: `_OUTPUT_FORMAT`, `PAIRWISE_SYSTEM_PROMPT`; `llm_curator.py`: `parse_curation` | Gu et al. (2024) tratam explicações e formato de saída como ferramentas de desenho do prompt (§3.1.2, conforme excerto do HTML v6 obtido por ferramenta de resumo; confirmar no PDF) |
| **F. Limitações** | Seção própria, com o que o juiz não garante | Seção 4 deste documento; `AVALIACAO_PIPELINE.md` §6 | Chiang & Lee (2023) discutem limitações e ética do uso de LLM como avaliador |

## 3. Decisões de design do prompt

- **Sem exemplos (few-shot).** Exemplos no prompt ancoram a nota em casos específicos e podem importar o viés de quem os escolheu, inclusive de tamanho e estilo. A rubrica com âncoras descritivas dá a mesma referência sem fixar um trecho. Gu et al. mencionam few-shot e *chain-of-thought* como técnicas possíveis (§3.1.1, seção a confirmar no PDF); aqui a escolha foi não usar few-shot, e isso é uma decisão a ser validada com `agreement`, não um resultado da literatura.
- **Justificativa antes da nota.** Forçar o modelo a escrever a evidência de cada critério antes do número faz a nota ser consequência de uma justificativa registrada, e deixa o motivo auditável por trecho.
- **Escala 0 a 10 com âncoras.** Faixas de 0–2, 3–4, 5–6, 7–8 e 9–10, com descrição de cada uma, reduzem a ambiguidade do que é "7" e permitem comparar execuções. Em factualidade, a faixa 5–6 é explicitamente neutra: o juiz não tem como verificar fatos externos e não deve inventar nota alta ou baixa por isso.
- **Notas estritas (valor ausente ou inválido é rejeitado).** `require_score` rejeita nota ausente, não numérica, NaN ou infinita e limita o valor a 0–10; que sejam inteiras é apenas pedido no prompt, não imposto.
- **Dado, não instrução.** O trecho e os candidatos entram entre tags; `wrap_excerpt` e `wrap_pair` removem tags delimitadoras (abertura e fechamento, repetidamente), e o prompt diz que o conteúdo é dado. Isso reduz, mas não elimina, o risco de injeção de prompt vinda do texto transcrito.

## 4. Limitações e considerações éticas

- **O juiz herda os vieses do modelo.** Troca de posição, cláusulas de prompt e juiz distinto do restaurador mitigam, mas não removem posição, verbosidade e autopreferência. O relatório avisa (`self_preference_warning`) quando juiz e restaurador são o mesmo modelo, mas o aviso não corrige o viés.
- **A concordância com humanos precisa ser reverificada neste domínio.** O resultado de Chiang & Lee foi obtido em outras tarefas (geração aberta de histórias e ataques adversariais). Não há garantia de que valha para transcrições de fala em português. A medição neste corpus é `judge_reliability.py agreement` e depende de rótulos humanos que ainda precisam ser coletados.
- **Factualidade é "aparente".** O juiz não consulta fontes. Ele detecta contradição interna e alegações que parecem inventadas; não verifica fatos externos.
- **Ruído de ASR pode parecer incoerência.** Erros de reconhecimento de fala e legenda automática mal segmentada podem ser lidos como falta de coerência e puxar a nota para baixo sem que o conteúdo do falante seja ruim.
- **Custo e privacidade.** Cada execução extra (`CURATION_JUDGE_RUNS`) e cada troca de posição multiplicam chamadas. Os trechos vão para um provedor externo (OpenAI, por padrão), e são transcrições de vídeos de terceiros.
- **Mudar o prompt invalida notas antigas.** Notas de versões diferentes (`promptVersion`) não são comparáveis; ao mudar o prompt, é preciso recurar antes de comparar lotes.
- **Não substitui avaliação humana nem o experimento de *fine-tuning*.** O juiz é um indicador de qualidade, e o critério final de utilidade continua sendo o desempenho do modelo treinado em dataset bruto × processado.

## 5. Protocolo de reprodução

Variáveis e versões a registrar no TCC:

- `JUDGE_MODEL` (modelo do juiz pareado; deve ser diferente do restaurador, que usa `OPENAI_MODEL`)
- `CURATION_JUDGE_RUNS` (execuções por trecho na curadoria; padrão 1)
- `CURATION_PROMPT_VERSION = curation-v2` e `PAIRWISE_PROMPT_VERSION = pairwise-v2`
- temperatura 0 e `JUDGE_SEED = 42` (fixos no código)

Comandos (a partir de `backend/`):

```bash
# Julgamento pareado com troca de posição; gera eval/judge.csv e emite o aviso de autopreferência quando aplicável
JUDGE_MODEL=<modelo-diferente-do-restaurador> \
  venv/bin/python3 scripts/evaluate_pipeline.py corpus.json --out eval/ --judge 60

# Concordância do juiz com rótulos humanos (CSVs com colunas id e outcome)
venv/bin/python3 scripts/judge_reliability.py agreement --judge eval/judge.csv --human human.csv

# Estabilidade da nota a variações de redação do prompt
venv/bin/python3 scripts/judge_reliability.py stability corpus.json --n 30
```

O `human.csv` usa o mesmo formato do `judge.csv`: coluna `id` e coluna `outcome` (`processed`, `raw` ou `tie`).

## 6. Nota de verificação das citações

- Chiang, C.-H. & Lee, H.-y. (2023). *Can Large Language Models Be an Alternative to Human Evaluations?* ACL 2023.
- Gu, J. et al. (2024). *A Survey on LLM-as-a-Judge.* arXiv:2411.15594.

As afirmações atribuídas a Chiang & Lee foram conferidas no resumo do artigo. As afirmações sobre Gu et al. sem número de seção vêm do abstract. Os números de seção de Gu et al. (§2.1.4, §2.4.1, §3.1.1, §3.1.2, §3.2.1, §3.3.1) vêm de um excerto da versão HTML v6 obtido por ferramenta de resumo, ou seja, são de segunda mão e não foram lidos diretamente no texto completo. **Antes de usar qualquer citação ou número de seção no texto final do TCC, releia o PDF e confirme a seção e o trecho.** Este documento não reproduz citações literais nem valores numéricos dos artigos.
