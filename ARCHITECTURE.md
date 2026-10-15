# Arquitetura Técnica — GuitarWeb

## 1. Visão Geral do Sistema

O **GuitarWeb** é uma aplicação web para aprendizado de guitarra com feedback visual e sonoro em tempo real. O produto é desenhado para operar inteiramente no navegador via Web Audio API, sem instalação de drivers proprietários ou softwares auxiliares no computador do usuário.

```mermaid
flowchart TD
    subgraph EntradaFisica["Hardware do Usuário"]
        Gtr["Guitarra Elétrica (Captador Magnético)"] -->|"Cabo P10"| USB["Interface de Áudio USB (Hi-Z/Linha)"]
        USB -->|"Driver OS (ALSA / CoreAudio / WASAPI)"| WebAudioIn["Navegador: navigator.mediaDevices"]
    end

    subgraph PipelineAudio["Pipeline de Áudio Cliente (Web Audio API)"]
        WebAudioIn -->|"createMediaStreamSource"| AudioCtx["AudioContext (44.1 / 48 kHz)"]
        AudioCtx --> Splitter["ChannelSplitterNode (2 Canais)"]
        Splitter -->|"Canal Selecionado (Entrada 1 ou 2)"| Analyser["AnalyserNode (FFT: 2048)"]
        Analyser --> MathMetrics["Cálculo RMS, Peak dBFS e Detecção de Clip"]
    end

    subgraph UIClient["Interface e Renderização (60 FPS)"]
        MathMetrics -->|"Telemetria Contínua"| VUMeter["VU Meter Digital (-60 a 0 dBFS)"]
        MathMetrics -->|"FloatTimeDomainData"| Scope["Osciloscópio em Canvas"]
        MathMetrics -->|"Alerta de Saturação"| ClipLED["Indicador de Clipping Digital"]
    end

    subgraph BackendRails["Backend Rails 8 (Fora do Caminho Crítico)"]
        Controller["AudioDiagnosticsController"] --> View["show.html.erb"]
        DockerPG[("PostgreSQL 16 (Container Docker :5433)")]
    end

    View -.-> UIClient
```

---

## 2. Decisões Arquiteturais e Isolamento de Responsabilidade

### 2.1 Separação Estrita de Áudio e Backend
* **Zero processamento de áudio no backend:** Todo o streaming e cálculo de amplitude/frequência ocorre localmente na máquina do usuário.
* **Segurança e Privacidade:** O sinal capturado nunca trafega pela rede, evitando vazamento de privacidade e eliminando gargalos de latência.
* **Papel do Rails:** Prover autenticação, servir a aplicação com Vite, armazenar configurações de ganho/latência e gerenciar arquivos privados de tablatura.

### 2.2 Seleção de Canal de Entrada de Hardware
Interfaces USB comuns de 2 canais (como Focusrite Scarlett 2i2, Behringer UMC202HD, EVO 4) costumam ter o pré-amplificador de instrumento/Hi-Z roteado para o **Canal 2** físico. Para evitar que a guitarra fique muda quando o navegador captura apenas o canal esquerdo (Canal 1), o pipeline implementa chaveamento com `ChannelSplitterNode`.

---

## 3. Fluxo de Dados de Áudio

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuário (Guitarrista)
    participant UI as Interface Web (DOM)
    participant Engine as AudioEngine (TypeScript)
    participant HW as Hardware USB (Web Audio API)

    User->>UI: Clica em "Atualizar Dispositivos"
    UI->>Engine: requestPermissions() & listInputDevices()
    Engine->>HW: navigator.mediaDevices.enumerateDevices()
    HW-->>Engine: Lista de MediaDeviceInfo (audioinput)
    Engine-->>UI: Popula dropdown com nomes das interfaces

    User->>UI: Seleciona Interface + Canal 2 e clica "Conectar"
    UI->>Engine: connect(deviceId, channelIndex = 1)
    Engine->>HW: getUserMedia({ audio: { echoCancellation: false } })
    HW-->>Engine: MediaStream puro
    Engine->>Engine: Inicia AudioContext & AnalyserNode

    loop Loop a 60 FPS (requestAnimationFrame)
        UI->>Engine: getMetrics()
        Engine-->>UI: { rmsDb, peakDb, isClipping, timeDomainData }
        UI->>UI: Redesenha VU Meter e Osciloscópio
    end
```

---

## 4. Guia de Teste com Hardware Físico

1. Conecte a guitarra na entrada com a chave **INST** / **Hi-Z** ligada na interface USB.
2. Inicie a aplicação local e acesse `http://localhost:3000/diagnostics/audio`.
3. Selecione a interface USB no seletor de dispositivos.
4. Escolha o canal físico correto (Canal 1 para entradas frontais únicas ou Canal 2 para interfaces estéreo com instrumento no canal direito).
5. Clique em **"Conectar e Iniciar Teste"**.
6. Toque notas na guitarra e verifique a resposta em tempo real no VU meter e na forma de onda do osciloscópio.
