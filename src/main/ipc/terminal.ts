import { terminalContract, terminalOneWayContract } from '@shared/contract/terminal.contract.js'
import { terminalService } from '../terminal/terminal-service.js'
import { registerContract, registerOneWay } from './register.js'

export function setupTerminalIpcHandlers(): void {
  registerContract(terminalContract, {
    'terminal.open': (request) => terminalService.open(request),
    'terminal.close': (terminalId) => terminalService.close(terminalId),
  })

  registerOneWay(terminalOneWayContract, {
    'terminal.write': (_sender, terminalId, data) => {
      terminalService.write(terminalId, data)
    },
    'terminal.resize': (_sender, terminalId, cols, rows) => {
      terminalService.resize(terminalId, cols, rows)
    },
  })
}
