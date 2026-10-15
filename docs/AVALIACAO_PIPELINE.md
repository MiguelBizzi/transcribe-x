# Validação do processamento: bruto × processado

Este documento registra por que as métricas do texto bruto e do processado empatavam, o que foi corrigido e a evidência pareada de que o processamento melhora o texto. Os números vêm de `backend/scripts/evaluate_pipeline.py` sobre o corpus local (109 vídeos distintos, 339 mil palavras, 90% em português). Relatórios completos, tabelas por documento e veredictos do juiz estão em [`avaliacao/`](avaliacao/).

## 1. Diagnóstico: por que as métricas eram iguais

Médias armazenadas antes da correção (110 transcrições): quality score 0,699 → 0,707; MTLD 43,1 → 44,5; MATTR 0,686 → 0,688. Quatro causas, todas confirmadas no corpus:

1. **A maior deficiência do texto bruto não era tratada.** 72 de 109 vídeos (66%) usam legenda automática, que chega sem pontuação: a "sentença" média tinha 1.950 palavras. O processamento não criava fronteiras de frase, então o termo de fluência do score (40% do peso) valia ≈ 0 nas duas versões, e a legibilidade também.
2. **O que a limpeza remove é pouco em volume.** Hesitações, repetições e vírgulas órfãs somam cerca de 1–3% dos tokens. Remover 100% delas move uma taxa de 1,5% para 0%, o que vira +0,005 no score. A melhoria era consistente (106/109 documentos, p < 10⁻¹⁸), mas pequena em valor absoluto.
3. **MTLD e MATTR medem diversidade lexical, não limpeza.** Foram desenhados para ser robustos ao comprimento; tirar 3% dos tokens quase não os move. Não há razão teórica para que um texto limpo seja muito mais diverso. Forçar esses números para cima seria manipular a métrica; o papel correto deles é mostrar que o conteúdo foi preservado.
4. **Dois defeitos do processamento apagavam conteúdo.**
   - A lista de hesitações do inglês era unida à de todas as línguas, e `um` — artigo indefinido do português — era removido como hesitação: 3.689 ocorrências, 65% de todas as "hesitações" removidas em português.
   - A limpeza residual apagava letras isoladas fora de uma lista de palavras funcionais: 3.252 tokens de conteúdo (`raiz de x`, `item b`, siglas soletradas). O bruto ainda era penalizado por esses "artefatos".
5. **Três defeitos adicionais, encontrados ao auditar a playlist de inglês** (legendas manuais de diálogo, nas quais o processado chegava a ficar pior que o bruto):
   - O colapso de repetições atravessava fronteiras de frase: `You need a bed. A bed.` perdia `A bed.`, e `Go straight. Go straight.` perdia uma frase inteira. É repetição didática, não hesitação.
   - A vírgula ao lado de número era tratada como órfã: `3,5` virava `35`. Os 242 decimais do corpus estavam corrompidos no texto processado.
   - A hesitação removida deixava a pontuação para trás: `Oxford? Hmm.` virava `Oxford?.`.
6. **A detecção de idioma não era reprodutível.** O `langdetect` sorteia sem semente e não é seguro sob concorrência: na avaliação paralela, dois vídeos em português foram classificados como esloveno, o que muda a fórmula de Flesch e a lista de hesitações. Com semente fixa e acesso serializado, o mesmo texto sempre recebe o mesmo idioma.

## 2. O que mudou

| Mudança | Arquivo | Efeito |
|---|---|---|
| Hesitações só do idioma detectado | `text_processor.py` (`filler_set`) | O artigo `um` deixa de ser apagado |
| Letras isoladas preservadas | `text_processor.py` (`strip_residual_artifacts`) | Variáveis, itens e siglas ficam no texto |
| Repetição só colapsa dentro da frase | `text_processor.py` (`collapse_repetitions`) | Diálogo e exercícios repetidos ficam |
| Vírgula entre números preservada | `text_processor.py` (`_orphan_comma_indexes`) | `3,5` continua `3,5` |
| Pontuação órfã de hesitação removida | `text_processor.py` (`normalize_sentences`) | `Oxford? Hmm.` → `Oxford?` |
| Detecção de idioma determinística | `text_processor.py` (`detect_language`) | Mesmo texto, mesmo idioma, em qualquer execução |
| Restauração de pontuação por LLM | `punctuation_restorer.py` | Legenda automática ganha frases, vírgulas e maiúsculas |
| Avaliação pareada | `evaluate_pipeline.py` | Testes estatísticos por documento, métricas independentes, juiz cego |

**Garantia da restauração de pontuação.** O LLM só propõe; as palavras dele nunca entram no texto. A proposta é alinhada aos tokens da legenda e apenas pontuação e capitalização são copiadas. A sequência de palavras de saída é idêntica à de entrada por construção (testado em `test_punctuation_restorer.py`). A retenção de conteúdo é a mesma com e sem a etapa (99,4%), o que confirma no corpus que a pontuação não removeu palavras.

## 3. Protocolo de avaliação

- **Pareado.** Cada documento é o próprio controle: a mesma função mede o bruto e o processado. Para cada métrica: diferença média com IC 95% por *bootstrap*, proporção de documentos que melhoraram, teste de Wilcoxon de postos sinalizados e correlação rank-bisserial (*r*) como tamanho de efeito.
- **Estratificado** por tipo de legenda: automática (sem pontuação) e com pontuação.
- **Três famílias de métricas**, separadas para evitar circularidade:
  - *independentes*: definidas fora do pipeline — legibilidade de Flesch (adaptação de Martins et al., 1996, para o português), comprimento médio de sentença, taxa de *run-on* (palavras em sentenças com mais de 40 palavras) e julgamento cego pareado por LLM;
  - *das regras do pipeline*: quality score, densidade de hesitações e repetições, vírgulas órfãs — mostram que as regras foram aplicadas, mas são parcialmente circulares;
  - *de preservação*: MTLD, MATTR e retenção de conteúdo — devem ficar estáveis.
- **Ablação.** O mesmo protocolo roda só com a limpeza (`--no-punctuation`), para isolar a contribuição de cada etapa.

## 4. Resultados

Execução final, com todas as correções: 109 vídeos, juiz em 60 documentos sorteados.

### 4.1 Métricas independentes

| Métrica | Grupo | Bruto | Processado | Δ [IC 95%] | Melhorou | p | r |
|---|---|---|---|---|---|---|---|
| Flesch ↑ | automáticas (72) | 0,0 | 75,2 | +75,2 [73,2; 77,1] | 100% | < 0,001 | 1,00 |
| Sentença média (palavras) ↓ | automáticas (72) | 1.950 | 13,9 | −99,3% | 100% | < 0,001 | 1,00 |
| Taxa de *run-on* ↓ | automáticas (72) | 0,999 | 0,064 | −93,6% | 100% | < 0,001 | 1,00 |
| Flesch ↑ | todos (109) | 28,1 | 77,6 | +49,6 [43,0; 56,1] | 67% | < 0,001 | 0,87 |
| Taxa de *run-on* ↓ | todos (109) | 0,673 | 0,055 | −91,8% | 74% | < 0,001 | 0,98 |

### 4.2 Julgamento cego pareado

60 documentos sorteados; trechos de ~180 palavras do bruto e do processado, em ordem A/B aleatória; o juiz (gpt-4o-mini) escolhe o melhor texto para dataset de treino.

| Grupo | n | Processado vence | Bruto vence | Empate | p (teste do sinal) |
|---|---|---|---|---|---|
| todos | 60 | 50 (83%) | 5 | 5 | < 0,001 |
| automáticas | 39 | 39 (100%) | 0 | 0 | < 0,001 |
| com pontuação | 21 | 11 (52%) | 5 | 5 | 0,210 |

### 4.3 Regras do pipeline e preservação

| Métrica | Bruto | Processado | Δ rel. | Melhorou | Piorou | p |
|---|---|---|---|---|---|---|
| Quality score ↑ | 0,697 | 0,964 | +38,3% | 87% | 3% | < 0,001 |
| Densidade de hesitações ↓ | 0,005 | 0,000 | −100% | 85% | 0% | < 0,001 |
| Densidade de repetições ↓ | 0,006 | 0,002 | −65,7% | 76% | 9% | < 0,001 |
| MTLD | 49,3 | 50,8 | +3,2% | 64% | 25% | < 0,001 |
| MATTR | 0,717 | 0,719 | +0,3% | 67% | 18% | < 0,001 |
| Retenção de conteúdo | — | 99,4% (mín. 97,8%) | — | — | — | — |

Os 3 documentos em que o quality score cai (todos com legenda pontuada) caem entre 0,0004 e 0,0006. Remover hesitações de dentro das frases as encurta um pouco (por exemplo, de 8,02 para 7,94 palavras), e o termo de fluência penaliza frases abaixo de 8 palavras.

### 4.4 Ablação: contribuição de cada etapa

| Configuração | Quality score | Flesch | Sentença média | MTLD |
|---|---|---|---|---|
| Bruto | 0,697 | 28,1 | 1.291 | 49,3 |
| Só limpeza | 0,700 | 28,0 | 1.278 | 50,8 |
| Limpeza + pontuação | 0,964 | 77,6 | 12,0 | 50,8 |

A limpeza remove o ruído de fala (hesitações −100%, repetições −66%) com retenção de 99,4% do conteúdo. A restauração de pontuação é a etapa que transforma a legenda automática em texto legível. MTLD e MATTR mudam pouco e de forma idêntica nas duas configurações: o processamento não empobrece o vocabulário.

## 5. Como ler e defender os resultados

- **A melhoria é grande onde o problema é grande.** Legenda automática é dois terços do corpus. Nesses documentos, todas as métricas independentes melhoram em 100% dos casos, com efeito máximo (r = 1,00), e o juiz cego prefere o processado em 39 de 39.
- **Em legenda manual, o pipeline quase não mexe, e esse é o comportamento correto.** Legendas escritas por humanos (como a playlist *Easy English Conversations*) têm 0–0,6% de ruído. O processamento tira as poucas hesitações e não toca no resto: retenção de 99,7%, MATTR inalterado (Δ = 0,000, p = 0,97) e o juiz sem diferença significativa (p = 0,21). Um pipeline que "melhorasse muito" um texto que já está limpo estaria reescrevendo o falante.
- **As pequenas quedas em legenda manual têm causa conhecida.** O Flesch cai 0,4 ponto porque remover monossílabos como `hmm`, `ah`, `né` aumenta a média de sílabas por palavra. O MATTR cai em alguns documentos porque cada `Hmm` removido era um tipo distinto na janela (efeito de remoção de hápax).
- **MTLD e MATTR são evidência de preservação, não de melhoria.** O argumento é de não inferioridade: o processado não perde diversidade lexical (IC 95% do Δ de MTLD inteiramente positivo).

## 6. Limitações

- **Juiz e restaurador usam o mesmo modelo** (gpt-4o-mini), o que admite viés de autopreferência. Para a versão final, recomenda-se rodar o juiz com outro modelo (`JUDGE_MODEL=...`) e/ou uma amostra de avaliação humana com o mesmo protocolo cego.
- **Os trechos do juiz são alinhados por proporção de palavras**, não por alinhamento exato; parte das derrotas em legendas pontuadas cita sentenças cortadas na borda do trecho.
- **Fronteiras de bloco e reticências.** A pontuação é restaurada em blocos de 250 palavras; o modelo às vezes põe em maiúscula a primeira palavra do bloco sem fechar a frase anterior. Reticências (`...`) usadas pelo modelo para fala interrompida são tratadas como fim de frase. Ambos afetam só a capitalização e a contagem de sentenças, não as palavras.
- **Repetição enfática dentro da frase ainda colapsa** (`no, no, no!` → `no!`), porque não se distingue de hesitação sem informação prosódica.
- **O quality score é parcialmente circular** (pune o que o pipeline remove) e chega a 1,0 em todas as legendas automáticas (efeito teto). Por isso as conclusões se apoiam nas métricas independentes.
- **O critério final de utilidade** continua sendo o experimento de *fine-tuning* comparando datasets bruto × processado.
- A restauração de pontuação depende de um provedor externo; bloco que falha fica sem pontuação, e o campo `punctuationRestored` registra o resultado.

## 7. Reprodução

```bash
cd backend
venv/bin/python3 scripts/evaluate_pipeline.py corpus.json --out eval/ --judge 60
venv/bin/python3 scripts/evaluate_pipeline.py corpus.json --out eval-ablacao/ --no-punctuation
```

O comando de exportação do `corpus.json` está no cabeçalho do script. Chamadas ao LLM ficam em cache em `<out>/cache`, então reexecutar não custa novas chamadas.

Métricas já gravadas no banco só mudam quando cada transcrição é reprocessada (`pnpm reprocess:all`).
