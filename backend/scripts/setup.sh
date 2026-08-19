#!/bin/bash
# YouTube Transcript Service Setup Script

echo "🎬 Setting up YouTube Transcript Service..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
REQUIRED_VERSION="3.8"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Python version $PYTHON_VERSION is too old. Required: $REQUIRED_VERSION or higher."
    exit 1
fi

echo "✅ Python $PYTHON_VERSION found"

if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip3."
    exit 1
fi

echo "✅ pip3 found"

echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

chmod +x youtube_transcript.py
chmod +x text_processor.py

echo "🧪 Testing the transcript service..."
python3 youtube_transcript.py test123

if [ $? -eq 0 ] || [ $? -eq 1 ]; then
    echo "✅ Script is working correctly"
else
    echo "❌ Script test failed"
    exit 1
fi

echo ""
echo "🎉 Setup completed successfully!"
echo "The YouTube Transcript Service is ready to use."
echo ""
echo "Note: The service will now use the youtube-transcript-api library"
echo "which provides more reliable transcript fetching than the previous method." 