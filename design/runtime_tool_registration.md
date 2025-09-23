# Runtime Tool Registration Design

## Overview

This document outlines the design for dynamically registering tools at runtime without requiring server restarts. The solution builds on the existing `simpletooling_template` structure and `load_tool_from_module()` functionality.

## Current Architecture

### Existing Components
- `tools/toolset.py` - Creates shared toolset instance
- `tools/calculator.py` - Example tool with `@toolset.add()` decorators
- `simpletooling/indexing.py` - Contains `load_tool_from_module()` for startup tool loading
- `ToolRegistry` - Manages tool registration and endpoint creation

### Current Limitations
- Tools are only loaded at startup via `load_tool_from_module(tools)`
- Adding new tool files requires server restart
- No runtime registration capability

## Proposed Solution

### 1. Single File Loading (Primary Solution)

#### New Function in `indexing.py`
```python
def load_single_tool_file(file_path: str, tools_module):
    """
    Load a single Python tool file and register its functions.

    Args:
        file_path: Path to the Python file (e.g., "tools/new_tool.py")
        tools_module: The tools module for namespace resolution

    Returns:
        Dict with status and module info or error details
    """
    file_path = Path(file_path)

    # Validate file exists and is Python
    if not file_path.exists() or file_path.suffix != '.py':
        raise ValueError(f"Invalid Python file: {file_path}")

    # Convert path to module name
    tools_path = Path(tools_module.__file__).parent
    if not file_path.is_relative_to(tools_path):
        raise ValueError(f"File must be within tools directory: {file_path}")

    relative_path = file_path.relative_to(tools_path)
    module_name = str(relative_path.with_suffix(''))
    module_name = module_name.replace(os.sep, '.')
    full_module_name = f"{tools_module.__name__}.{module_name}"

    # Remove from cache if already loaded (for reloading)
    if full_module_name in sys.modules:
        del sys.modules[full_module_name]

    # Import the specific module
    try:
        importlib.import_module(full_module_name)
        return {"status": "success", "module": full_module_name}
    except ImportError as e:
        return {"status": "error", "error": str(e)}
```

#### New HTTP Endpoints in `toolset.py`
```python
@self.app.post("/load_tool_file", tags=["Tools"])
async def load_tool_file(request: Dict[str, str]):
    """Load a single tool file"""
    file_path = request.get("file_path")
    if not file_path:
        raise HTTPException(400, "file_path required")

    import tools
    from .indexing import load_single_tool_file
    result = load_single_tool_file(file_path, tools)
    return result

@self.app.post("/reload_tool_file", tags=["Tools"])
async def reload_tool_file(request: Dict[str, str]):
    """Reload a specific tool file"""
    return await load_tool_file(request)

@self.app.post("/scan_new_tools", tags=["Tools"])
async def scan_new_tools():
    """Scan tools/ directory for new files and load them"""
    import tools
    from .indexing import load_single_tool_file

    tools_path = Path(tools.__file__).parent
    loaded = []

    for py_file in tools_path.rglob("*.py"):
        if py_file.name != "__init__.py":
            relative_path = py_file.relative_to(tools_path.parent)
            module_name = f"tools.{str(relative_path.with_suffix(''))}"

            # Only load if not already in sys.modules
            if module_name not in sys.modules:
                result = load_single_tool_file(str(py_file), tools)
                if result["status"] == "success":
                    loaded.append(str(relative_path))

    return {"loaded_files": loaded}
```

### 2. Bulk Reload (Fallback Solution)

#### New Function in `tool_registry.py`
```python
def reload_tools_from_directory(self, tools_module, tools_dir: str = "tools"):
    """Dynamically reload all tools from tools/ directory"""
    # Get all currently loaded tool modules
    current_modules = {name: mod for name, mod in sys.modules.items()
                      if name.startswith(f"{tools_module.__name__}.")}

    # Clear module cache for tools directory
    for module_name in list(current_modules.keys()):
        if module_name in sys.modules:
            del sys.modules[module_name]

    # Reload all tools using existing load_tool_from_module
    from .indexing import load_tool_from_module
    load_tool_from_module(tools_module)

@self.app.post("/reload_all_tools", tags=["Tools"])
async def reload_all_tools():
    """Reload all tools from tools/ directory"""
    import tools
    importlib.reload(tools)
    self.tool_registry.reload_tools_from_directory(tools)
    return {"status": "success", "message": "All tools reloaded"}
```

## Usage Examples

### Adding a New Tool

1. **Create the tool file** (`tools/new_tool.py`):
```python
from tools.toolset import toolset

@toolset.add()
def new_function(x: int) -> str:
    """
    A new tool function.
    :param x: input number
    :return: processed result
    """
    return f"New tool result: {x}"
```

2. **Register the tool** (choose one method):

**Option A: Load specific file**
```bash
POST /load_tool_file
Content-Type: application/json

{"file_path": "tools/new_tool.py"}
```

**Option B: Scan for new tools**
```bash
POST /scan_new_tools
```

**Option C: Reload everything**
```bash
POST /reload_all_tools
```

### Subdirectory Support

Works with nested tool files:
```bash
# Load tool from subdirectory
POST /load_tool_file
{"file_path": "tools/math/advanced_calculator.py"}
```

### Tool Reloading

Reload a modified tool file:
```bash
POST /reload_tool_file
{"file_path": "tools/calculator.py"}
```

## Benefits

### Single File Loading
- ✅ **Efficient**: Only imports the specific file
- ✅ **Fast**: No full directory scan
- ✅ **Targeted**: Load exactly what you need
- ✅ **Reload support**: Handles module cache clearing
- ✅ **Path validation**: Ensures files are within tools directory
- ✅ **Subdirectory support**: Works with nested tool files
- ✅ **Error handling**: Returns detailed success/error status

### Bulk Reload
- ✅ **Simple**: One endpoint reloads everything
- ✅ **Reliable**: Reuses existing `load_tool_from_module` logic
- ✅ **Comprehensive**: Ensures all tools are loaded

## Optional Enhancements

### File Watching (Future)
```python
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class ToolFileHandler(FileSystemEventHandler):
    def __init__(self, toolset):
        self.toolset = toolset

    def on_modified(self, event):
        if event.src_path.endswith('.py') and 'tools/' in event.src_path:
            # Auto-reload when Python files change
            self.toolset.load_single_tool_file(event.src_path)
```

### Tool Management Endpoints
```python
# List all registered tools
GET /tools

# Remove/unregister a tool
DELETE /tools/{tool_name}

# Get tool metadata
GET /tools/{tool_name}/info
```

## Implementation Priority

1. **Phase 1**: Implement `load_single_tool_file()` in `indexing.py`
2. **Phase 2**: Add `/load_tool_file` and `/reload_tool_file` endpoints
3. **Phase 3**: Add `/scan_new_tools` endpoint
4. **Phase 4**: Add bulk reload endpoints as fallback
5. **Phase 5**: Optional file watching and management endpoints

## File Structure

```
simpletooling/
├── simpletooling/
│   ├── indexing.py           # Add load_single_tool_file()
│   ├── toolset.py           # Add new endpoints
│   └── tool_registry.py     # Add bulk reload (optional)
└── simpletooling_template/
    ├── tools/
    │   ├── __init__.py
    │   ├── toolset.py       # Shared toolset instance
    │   ├── calculator.py    # Existing tool
    │   └── new_tool.py      # New tools added here
    └── main.py              # Entry point
```

## Notes

- The solution leverages existing `@toolset.add()` decorator pattern
- FastAPI automatically updates OpenAPI documentation when new endpoints are registered
- Module cache clearing ensures proper reloading of modified files
- Path validation prevents loading files outside the tools directory
- Error handling provides clear feedback on import failures