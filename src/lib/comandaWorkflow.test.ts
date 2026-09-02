import { describe, expect, it } from 'vitest'
import {
  canMoveComandaStatus,
  getInvalidComandaTransitionMessage,
  isComandaStatus,
  nextComandaStatus,
} from './comandaWorkflow'

describe('flujo de estados de comandas', () => {
  it('avanza únicamente a la etapa operativa siguiente', () => {
    expect(canMoveComandaStatus('new', 'preparing')).toBe(true)
    expect(canMoveComandaStatus('preparing', 'ready')).toBe(true)
    expect(canMoveComandaStatus('ready', 'delivered')).toBe(true)
  })

  it('impide saltos, retrocesos y cambios desde el estado final', () => {
    expect(canMoveComandaStatus('new', 'ready')).toBe(false)
    expect(canMoveComandaStatus('ready', 'preparing')).toBe(false)
    expect(canMoveComandaStatus('delivered', 'ready')).toBe(false)
  })

  it('calcula el siguiente estado y valida destinos externos', () => {
    expect(nextComandaStatus('new')).toBe('preparing')
    expect(nextComandaStatus('delivered')).toBeNull()
    expect(isComandaStatus('ready')).toBe(true)
    expect(isComandaStatus('archive')).toBe(false)
  })

  it('explica por qué se rechazó un salto o un retroceso', () => {
    expect(getInvalidComandaTransitionMessage('new', 'delivered')).toContain('una etapa a la vez')
    expect(getInvalidComandaTransitionMessage('delivered', 'ready')).toContain('final')
  })
})
