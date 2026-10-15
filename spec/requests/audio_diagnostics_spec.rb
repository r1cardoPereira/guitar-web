# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'AudioDiagnostics', type: :request do
  describe 'GET /diagnostics/audio' do
    it 'retorna status 200 de sucesso e renderiza a tela de diagnóstico' do
      # Arrange (Preparação de estado)
      # Acesso à rota de diagnóstico de hardware

      # Act (Execução da requisição)
      get '/diagnostics/audio'

      # Assert (Validação de resposta e elementos críticos do DOM)
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('GuitarWeb')
      expect(response.body).to include('Diagnóstico de Áudio USB')
      expect(response.body).to include('device-select')
      expect(response.body).to include('channel-select')
      expect(response.body).to include('vu-canvas')
      expect(response.body).to include('osc-canvas')
    end
  end

  describe 'GET / (root)' do
    it 'renderiza com sucesso a página de diagnóstico na raiz' do
      # Act
      get '/'

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('audio-diagnostics-container')
    end
  end
end
