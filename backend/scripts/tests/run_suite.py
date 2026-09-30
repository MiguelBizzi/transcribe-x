#!/usr/bin/env python3
import sys
from pathlib import Path

import pytest

sys.exit(pytest.main([str(Path(__file__).parent), *sys.argv[1:]]))
