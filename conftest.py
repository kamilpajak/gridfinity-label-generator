"""Root conftest: ensure repo root is on sys.path so `import catalog` works."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
