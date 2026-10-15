# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ApplicationRecord, type: :model do
  it 'é uma classe abstrata base para modelos ActiveRecord' do
    # Arrange & Act & Assert
    expect(described_class.abstract_class?).to be(true)
  end
end
