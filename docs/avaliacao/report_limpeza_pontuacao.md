# Avaliação pareada: bruto × processado (limpeza + pontuação (LLM))

Documentos: 109.

Pontuação restaurada em 72 de 72 legendas automáticas.

## Todos os documentos (n=109)

| Métrica | Família | n | Bruto | Processado | Δ médio [IC 95%] | Δ rel. | Melhorou | Piorou | p (Wilcoxon) | r (efeito) |
|---|---|---|---|---|---|---|---|---|---|---|
| flesch ↑ | independent | 109 | 28.087 | 77.649 | 49.562 [43.018, 56.142] | 176.5% | 67% | 21% | <0.001 | 0.87 |
| avgSentenceLength ↓ | independent | 109 | 1290.935 | 12.027 | -1278.908 [-1545.228, -1037.623] | -99.1% | 82% | 7% | <0.001 | 0.97 |
| runOnRate ↓ | independent | 109 | 0.673 | 0.055 | -0.618 [-0.700, -0.538] | -91.8% | 74% | 6% | <0.001 | 0.98 |
| qualityScore ↑ | rule-based | 109 | 0.697 | 0.964 | 0.267 [0.234, 0.301] | 38.3% | 87% | 3% | <0.001 | 1.00 |
| fillerDensity ↓ | rule-based | 109 | 0.005 | 0.000 | -0.005 [-0.006, -0.004] | -100.0% | 85% | 0% | <0.001 | 1.00 |
| repetitionDensity ↓ | rule-based | 109 | 0.006 | 0.002 | -0.004 [-0.005, -0.003] | -65.7% | 76% | 9% | <0.001 | 0.97 |
| orphanCommaRate ↓ | rule-based | 109 | 0.000 | 0.000 | -0.000 [-0.000, -0.000] | -100.0% | 10% | 0% | 0.003 | 1.00 |
| mtld ↑ | preservation | 109 | 49.257 | 50.828 | 1.571 [1.148, 2.061] | 3.2% | 64% | 25% | <0.001 | 0.73 |
| mattr ↑ | preservation | 109 | 0.717 | 0.719 | 0.002 [0.001, 0.002] | 0.3% | 67% | 18% | <0.001 | 0.71 |

Retenção de conteúdo (palavras não-hesitação do bruto presentes no processado): média 99.4%, mínimo 97.8%.

## Legendas automáticas (sem pontuação) (n=72)

| Métrica | Família | n | Bruto | Processado | Δ médio [IC 95%] | Δ rel. | Melhorou | Piorou | p (Wilcoxon) | r (efeito) |
|---|---|---|---|---|---|---|---|---|---|---|
| flesch ↑ | independent | 72 | 0.000 | 75.229 | 75.229 [73.204, 77.112] | —% | 100% | 0% | <0.001 | 1.00 |
| avgSentenceLength ↓ | independent | 72 | 1950.019 | 13.931 | -1936.088 [-2225.611, -1659.273] | -99.3% | 100% | 0% | <0.001 | 1.00 |
| runOnRate ↓ | independent | 72 | 0.999 | 0.064 | -0.935 [-0.948, -0.919] | -93.6% | 100% | 0% | <0.001 | 1.00 |
| qualityScore ↑ | rule-based | 72 | 0.597 | 1.000 | 0.403 [0.402, 0.404] | 67.6% | 100% | 0% | <0.001 | 1.00 |
| fillerDensity ↓ | rule-based | 72 | 0.005 | 0.000 | -0.005 [-0.006, -0.004] | -100.0% | 96% | 0% | <0.001 | 1.00 |
| repetitionDensity ↓ | rule-based | 72 | 0.006 | 0.001 | -0.005 [-0.006, -0.004] | -78.0% | 93% | 7% | <0.001 | 0.99 |
| orphanCommaRate ↓ | rule-based | 72 | 0.000 | 0.000 | 0.000 [0.000, 0.000] | —% | 0% | 0% | 1.000 | 0.00 |
| mtld ↑ | preservation | 72 | 53.594 | 55.677 | 2.083 [1.506, 2.757] | 3.9% | 79% | 21% | <0.001 | 0.78 |
| mattr ↑ | preservation | 72 | 0.744 | 0.747 | 0.003 [0.002, 0.003] | 0.4% | 83% | 11% | <0.001 | 0.92 |

Retenção de conteúdo (palavras não-hesitação do bruto presentes no processado): média 99.3%, mínimo 97.8%.

## Legendas com pontuação (n=37)

| Métrica | Família | n | Bruto | Processado | Δ médio [IC 95%] | Δ rel. | Melhorou | Piorou | p (Wilcoxon) | r (efeito) |
|---|---|---|---|---|---|---|---|---|---|---|
| flesch ↑ | independent | 37 | 82.743 | 82.358 | -0.385 [-0.547, -0.236] | -0.5% | 3% | 62% | <0.001 | -0.99 |
| avgSentenceLength ↓ | independent | 37 | 8.394 | 8.323 | -0.071 [-0.122, -0.027] | -0.8% | 46% | 22% | 0.013 | 0.57 |
| runOnRate ↓ | independent | 37 | 0.040 | 0.038 | -0.002 [-0.004, -0.001] | -5.7% | 24% | 19% | 0.056 | 0.54 |
| qualityScore ↑ | rule-based | 37 | 0.893 | 0.896 | 0.003 [0.002, 0.004] | 0.3% | 62% | 8% | <0.001 | 0.93 |
| fillerDensity ↓ | rule-based | 37 | 0.006 | 0.000 | -0.006 [-0.008, -0.003] | -100.0% | 65% | 0% | <0.001 | 1.00 |
| repetitionDensity ↓ | rule-based | 37 | 0.005 | 0.003 | -0.002 [-0.003, -0.001] | -36.7% | 43% | 14% | <0.001 | 0.87 |
| orphanCommaRate ↓ | rule-based | 37 | 0.000 | 0.000 | -0.000 [-0.001, -0.000] | -100.0% | 30% | 0% | 0.003 | 1.00 |
| mtld ↑ | preservation | 37 | 40.816 | 41.392 | 0.576 [0.208, 0.989] | 1.4% | 35% | 32% | 0.040 | 0.47 |
| mattr ↑ | preservation | 37 | 0.665 | 0.665 | 0.000 [-0.001, 0.001] | 0.0% | 35% | 32% | 0.968 | -0.00 |

Retenção de conteúdo (palavras não-hesitação do bruto presentes no processado): média 99.7%, mínimo 98.7%.

## Julgamento cego pareado (LLM)

Trechos de ~180 palavras, ordem A/B sorteada, modelo gpt-4o-mini.

| Grupo | n | Processado vence | Bruto vence | Empate | p (sinal, bicaudal) |
|---|---|---|---|---|---|
| all | 60 | 50 | 5 | 5 | <0.001 |
| auto | 39 | 39 | 0 | 0 | <0.001 |
| punctuated | 21 | 11 | 5 | 5 | 0.210 |
