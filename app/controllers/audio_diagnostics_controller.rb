# frozen_string_literal: true

# Controller responsável por renderizar a página de diagnóstico de hardware de áudio.
# Permite ao usuário testar a conectividade da interface USB, inspecionar canais físicos,
# taxas de amostragem e níveis de sinal antes de iniciar os exercícios musicais.
class AudioDiagnosticsController < ApplicationController
  # Renderiza a visão principal com os seletores de hardware, medidor VU e osciloscópio.
  #
  # @return [void]
  def show
    # Não há processamento de áudio no backend; a página entrega os assets para execução local.
  end
end
