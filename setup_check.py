import sys, os, subprocess

checks = []

def ok(msg): checks.append(('PASS', msg))
def fail(msg): checks.append(('FAIL', msg))
def warn(msg): checks.append(('WARN', msg))

# Python version
v = sys.version_info
if v.major == 3 and v.minor >= 11:
    ok(f'Python {v.major}.{v.minor}.{v.micro}')
else:
    fail(f'Python {v.major}.{v.minor} - need 3.11+')

# .env
if os.path.exists('.env'):
    ok('.env exists')
    from dotenv import load_dotenv; load_dotenv()
    keys = ['GROQ_API_KEY','CEREBRAS_API_KEY','GITHUB_TOKEN']
    found = [k for k in keys if os.getenv(k)]
    if found: ok(f'API keys found: {found}')
    else: fail('No API keys set in .env')
else:
    fail('.env missing - copy from .env.example')

# ChromaDB
if os.path.exists('chroma_db'):
    ok('chroma_db index exists')
else:
    warn('chroma_db missing - run indexer first')

# Ollama
try:
    import requests
    r = requests.get('http://localhost:11434/api/tags', timeout=2)
    if r.status_code == 200:
        models = [m['name'] for m in r.json().get('models', [])]
        ok(f'Ollama running. Models: {models}')
except:
    warn('Ollama not running - cloud LLM fallback will be used')

# Dependencies
try:
    import flask, langchain, langgraph, chromadb
    ok('Core dependencies installed')
except ImportError as e:
    fail(f'Missing dependency: {e}')

# Print results
print()
print('=' * 45)
print('  THE EYE OPENER - Setup Check')
print('=' * 45)
for status, msg in checks:
    icon = '[OK]  ' if status=='PASS' else '[FAIL]' if status=='FAIL' else '[WARN]'
    print(f'  {icon} {msg}')
print('=' * 45)
failures = [m for s,m in checks if s=='FAIL']
if failures:
    print(f'  {len(failures)} issue(s) to fix before running.')
else:
    print('  All checks passed. Run start.bat to launch.')
print()
