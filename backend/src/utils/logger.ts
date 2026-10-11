import fs from 'fs'
import path from 'path'

interface LogEntry {
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  message: string
  data?: any
}

class Logger {
  private logDir: string
  private authLogFile: string
  private generalLogFile: string
  private maxFileSize: number = 10 * 1024 * 1024
  private maxFiles: number = 5

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs')
    this.authLogFile = path.join(this.logDir, 'auth.log')
    this.generalLogFile = path.join(this.logDir, 'general.log')
    
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true })
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
    return `[${entry.timestamp}] ${entry.level}: ${entry.message}${dataStr}\n`
  }

  private writeToFile(filePath: string, entry: LogEntry) {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        if (stats.size > this.maxFileSize) {
          this.rotateFile(filePath)
        }
      }

      const logLine = this.formatLogEntry(entry)
      fs.appendFileSync(filePath, logLine)
    } catch (error) {
      console.error('Failed to write to log file:', error)
    }
  }

  private rotateFile(filePath: string) {
    try {
      const fileExtension = path.extname(filePath)
      const baseName = path.basename(filePath, fileExtension)
      const dirName = path.dirname(filePath)

      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldFile = path.join(dirName, `${baseName}.${i}${fileExtension}`)
        const newFile = path.join(dirName, `${baseName}.${i + 1}${fileExtension}`)
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile)
          } else {
            fs.renameSync(oldFile, newFile)
          }
        }
      }

      const rotatedFile = path.join(dirName, `${baseName}.1${fileExtension}`)
      fs.renameSync(filePath, rotatedFile)
    } catch (error) {
      console.error('Failed to rotate log file:', error)
    }
  }

  private log(level: LogEntry['level'], message: string, data?: any, logFile?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    }

    const consoleMessage = `[${entry.timestamp}] ${level}: ${message}`
    switch (level) {
      case 'ERROR':
        console.error(consoleMessage, data || '')
        break
      case 'WARN':
        console.warn(consoleMessage, data || '')
        break
      case 'DEBUG':
        console.debug(consoleMessage, data || '')
        break
      default:
        console.log(consoleMessage, data || '')
    }

    const targetFile = logFile || this.generalLogFile
    this.writeToFile(targetFile, entry)
  }

  info(message: string, data?: any) {
    this.log('INFO', message, data)
  }

  warn(message: string, data?: any) {
    this.log('WARN', message, data)
  }

  error(message: string, data?: any) {
    this.log('ERROR', message, data)
  }

  debug(message: string, data?: any) {
    this.log('DEBUG', message, data)
  }

  authInfo(message: string, data?: any) {
    this.log('INFO', message, data, this.authLogFile)
  }

  authWarn(message: string, data?: any) {
    this.log('WARN', message, data, this.authLogFile)
  }

  authError(message: string, data?: any) {
    this.log('ERROR', message, data, this.authLogFile)
  }

  authDebug(message: string, data?: any) {
    this.log('DEBUG', message, data, this.authLogFile)
  }

  getAuthLogs(lines: number = 100): string[] {
    try {
      if (!fs.existsSync(this.authLogFile)) {
        return []
      }
      
      const content = fs.readFileSync(this.authLogFile, 'utf-8')
      const allLines = content.trim().split('\n')
      return allLines.slice(-lines)
    } catch (error) {
      console.error('Failed to read auth logs:', error)
      return []
    }
  }

  cleanup(daysToKeep: number = 7) {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
      
      const files = fs.readdirSync(this.logDir)
      files.forEach(file => {
        const filePath = path.join(this.logDir, file)
        const stats = fs.statSync(filePath)
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath)
          console.log(`Cleaned up old log file: ${file}`)
        }
      })
    } catch (error) {
      console.error('Failed to cleanup log files:', error)
    }
  }
}

export const logger = new Logger()