# ADR-001: Pipeline de Áudio Local no Navegador com Rails 8 e Vite

## Status: Aceito
## Data: 2026-10-14

## Contexto
O projeto visa construir uma experiência de aprendizado de guitarra com feedback em tempo real no estilo Yousician, conectando uma guitarra elétrica diretamente através de uma interface de áudio USB sem instalação de drivers proprietários ou softwares auxiliares pesados.

## Decisão
1. **Processamento 100% no Cliente:** Uso exclusivo da Web Audio API (`AudioContext`, `AnalyserNode` e futuramente `AudioWorklet`) no navegador do usuário, com zero envio de pacotes de áudio para servidores remotos.
2. **Frontend com Vite + TypeScript:** Adoção de Vite integrado ao Rails 8 para viabilizar tipagem estrita de arrays (`Float32Array`), empacotamento ágil de Web Workers e integração nativa com bibliotecas de notação musical (`alphaTab`).
3. **Persistência PostgreSQL em Docker:** O banco de dados roda em container Docker isolado na porta `5433` com volume persistente para não conflitar com serviços locais da máquina.
4. **Backend Rails 8:** Mantido estritamente fora do caminho crítico de áudio, atuando apenas para servir a aplicação web e futuras persistências de progresso e arquivos privados de partituras.

## Consequências
✅ **Latência mínima:** Processamento analógico-digital imediato na máquina do usuário sem dependência de rede.  
✅ **Privacidade absoluta:** Nenhuma captura de microfone ou sinal de áudio é enviada para servidores externos.  
✅ **Robustez em hardware:** Suporte a chaveamento de canais (Canal 1 e Canal 2) para compatibilidade com interfaces que utilizam a entrada direita como Hi-Z.  
❌ **Dependência de suporte do navegador:** Requer navegadores modernos com suporte à Web Audio API e contexto seguro (`localhost` ou HTTPS).  
⚠️ **Limitações de drivers do SO:** Latências de buffer dependem da configuração de áudio do sistema operacional do usuário (ALSA/PulseAudio/WASAPI/CoreAudio).
