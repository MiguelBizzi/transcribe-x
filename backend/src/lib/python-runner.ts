import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

export interface PythonRunnerOptions {
    pythonPath?: string
    timeout?: number
}

export function resolvePythonPath(pythonPath?: string): string {
    if (pythonPath) {
        return pythonPath
    }

    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3')
    return existsSync(venvPython) ? venvPython : 'python3'
}

export function resolveScriptPath(scriptName: string): string {
    return path.join(process.cwd(), 'scripts', scriptName)
}

export function executePythonScript<TPayload, TResult>(
    scriptPath: string,
    payload: TPayload,
    options: PythonRunnerOptions = {},
): Promise<TResult> {
    const pythonPath = resolvePythonPath(options.pythonPath)
    const timeout = options.timeout ?? 15000

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn(pythonPath, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd(),
        })

        const timeoutId = setTimeout(() => {
            pythonProcess.kill('SIGTERM')
            reject(new Error(`Python script timeout: ${scriptPath}`))
        }, timeout)

        let stdout = ''
        let stderr = ''

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString()
        })

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString()
        })

        pythonProcess.on('close', (code) => {
            clearTimeout(timeoutId)

            try {
                resolve(JSON.parse(stdout) as TResult)
            } catch {
                reject(
                    new Error(
                        `Failed to parse Python output (code ${code}): ${stdout}\nStderr: ${stderr}`,
                    ),
                )
            }
        })

        pythonProcess.on('error', (error) => {
            clearTimeout(timeoutId)
            reject(
                new Error(`Failed to execute Python script: ${error.message}`),
            )
        })

        pythonProcess.stdin.write(JSON.stringify(payload))
        pythonProcess.stdin.end()
    })
}
