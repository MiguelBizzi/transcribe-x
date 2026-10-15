import process from 'node:process'

process.stdout.write(JSON.stringify({ success: false, error: 'boom' }))
process.exit(1)
