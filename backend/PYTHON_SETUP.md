# Python Setup Guide for YouTube Transcription Service

## Overview

This project uses a Python virtual environment to run the YouTube transcription service. This guide explains how to set up and manage the Python environment.

## Quick Setup

### 1. Create Virtual Environment

```bash
# Create a new virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate     # On Windows
```

### 2. Install Dependencies

```bash
# Make sure you're in the virtual environment (venv)
cd scripts
pip install -r requirements.txt
```

### 3. Test Installation

```bash
# Test the Python script directly
python3 scripts/youtube_transcript.py dQw4w9WgXcQ

# Test from Node.js
npm run transcript:test
```

## Environment Management

### Activating the Environment

```bash
# Always activate before running the service
source venv/bin/activate

# Your prompt should show (venv) indicating it's active
(venv) ➜  transcribe-x-backend
```

### Deactivating the Environment

```bash
# When you're done working
deactivate
```

### Updating Dependencies

```bash
# Activate environment first
source venv/bin/activate

# Update pip
pip install --upgrade pip

# Update specific packages
pip install --upgrade youtube-transcript-api

# Or update all packages
pip list --outdated | cut -d ' ' -f1 | xargs -n1 pip install -U
```

## Troubleshooting

### Common Issues

1. **Permission Denied**

    ```bash
    # Make scripts executable
    chmod +x scripts/setup.sh
    chmod +x scripts/youtube_transcript.py
    ```

2. **Python Not Found**

    ```bash
    # Check Python installation
    python3 --version

    # Install Python if needed (macOS)
    brew install python3

    # Install Python if needed (Ubuntu/Debian)
    sudo apt-get install python3 python3-pip
    ```

3. **Dependencies Missing**

    ```bash
    # Activate environment and reinstall
    source venv/bin/activate
    pip install -r scripts/requirements.txt
    ```

4. **Virtual Environment Corrupted**
    ```bash
    # Remove and recreate
    rm -rf venv
    python3 -m venv venv
    source venv/bin/activate
    pip install -r scripts/requirements.txt
    ```

### Environment Variables

The service automatically detects and uses the virtual environment. You can also specify a custom Python path:

```typescript
import { TranscriptionService } from '@/lib/transcription-service'

const transcriptionService = new TranscriptionService({
    pythonPath: '/custom/path/to/python3',
    scriptPath: './custom/path/to/script.py',
    timeout: 60000,
})
```

## Development Workflow

### Daily Usage

1. **Start Development**

    ```bash
    # Activate Python environment
    source venv/bin/activate

    # Start Node.js development
    npm run dev
    ```

2. **Testing Changes**

    ```bash
    # Test Python script changes
    python3 scripts/youtube_transcript.py dQw4w9WgXcQ

    # Test Node.js service
    npm run transcript:test
    ```

3. **Adding New Dependencies**

    ```bash
    # Activate environment
    source venv/bin/activate

    # Install new package
    pip install new-package

    # Update requirements.txt
    pip freeze > scripts/requirements.txt
    ```

### Production Deployment

For production, consider:

1. **Using System Python** instead of virtual environment
2. **Installing dependencies globally** with proper version pinning
3. **Using Docker** for consistent environments
4. **Setting up proper logging** and monitoring

## Package Management

### Current Dependencies

- `youtube-transcript-api` - Main transcription library
- `requests` - HTTP client (dependency of youtube-transcript-api)
- `defusedxml` - Safe XML parsing (dependency of youtube-transcript-api)

### Adding New Packages

```bash
# Activate environment
source venv/bin/activate

# Install new package
pip install package-name

# Update requirements.txt
pip freeze > scripts/requirements.txt

# Commit changes
git add scripts/requirements.txt
git commit -m "Add new Python dependency: package-name"
```

## Security Considerations

1. **Virtual Environment Isolation** - Dependencies are isolated from system Python
2. **Regular Updates** - Keep packages updated for security patches
3. **Dependency Review** - Review new packages before adding to requirements.txt
4. **Environment Locking** - Consider using `pip-tools` for dependency locking

## Performance Notes

- **Startup Time**: Virtual environment adds ~100ms to first script execution
- **Memory Usage**: Minimal overhead (~5-10MB per Python process)
- **Concurrency**: Safe for multiple simultaneous transcript requests
- **Caching**: Consider implementing Redis for repeated transcript requests

## Monitoring

### Health Checks

The service includes built-in health checks:

```typescript
// Check if Python script is available
const health = await transcriptionService.checkPythonScript()
console.log('Service healthy:', health.available)
```

### Logs

Monitor these logs for issues:

- Python script execution errors
- Timeout errors
- JSON parsing errors
- Process spawn failures

## Support

If you encounter issues:

1. Check this guide first
2. Verify Python environment is activated
3. Test Python script directly
4. Check Node.js service logs
5. Verify file permissions and paths
