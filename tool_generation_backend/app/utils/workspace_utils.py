"""
Workspace management utilities for persistent repository storage and session isolation.

This module provides functions for managing workspace directories, git repositories,
and session-specific work areas.
"""

import asyncio
import logging
import shutil
import json
from typing import Dict, Any, Optional, List
from pathlib import Path
import aiofiles

logger = logging.getLogger(__name__)

# Workspace configuration
PROJECT_ROOT = Path("/Users/alwyn/Developer/matterlab/agent-browser")
WORKSPACES_DIR = PROJECT_ROOT / "workspaces"
REPOS_DIR = WORKSPACES_DIR / "repos"
SESSIONS_DIR = WORKSPACES_DIR / "sessions"


class WorkspaceManager:
    """Manager for workspace operations and repository handling."""

    def __init__(self):
        """Initialize workspace manager."""
        self.repos_dir = REPOS_DIR
        self.sessions_dir = SESSIONS_DIR
        self._ensure_directories()

    def _ensure_directories(self):
        """Ensure workspace directories exist."""
        self.repos_dir.mkdir(parents=True, exist_ok=True)
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Workspace directories initialized: {WORKSPACES_DIR}")

    async def get_or_clone_repository(self, library: str) -> Dict[str, Any]:
        """
        Get existing repository or clone it if not present.

        Args:
            library: Library name (rdkit, ase, pymatgen, pyscf)

        Returns:
            Dict with repository information
        """
        try:
            repo_urls = {
                "rdkit": "https://github.com/rdkit/rdkit.git",
                "ase": "https://github.com/rosswhitfield/ase.git",
                "pymatgen": "https://github.com/materialsproject/pymatgen.git",
                "pyscf": "https://github.com/pyscf/pyscf.git"
            }

            library_lower = library.lower()
            if library_lower not in repo_urls:
                return {
                    "success": False,
                    "error": f"Unknown library: {library}",
                    "available_libraries": list(repo_urls.keys())
                }

            repo_path = self.repos_dir / library_lower
            repo_url = repo_urls[library_lower]

            # Check if repository already exists
            if repo_path.exists() and (repo_path / ".git").exists():
                logger.info(f"Repository {library} already exists at {repo_path}")

                # Try to update it
                update_result = await self._update_repository(repo_path)
                if update_result["success"]:
                    return {
                        "success": True,
                        "library": library,
                        "path": str(repo_path),
                        "status": "updated",
                        "url": repo_url
                    }
                else:
                    logger.warning(f"Failed to update {library}, using existing version")
                    return {
                        "success": True,
                        "library": library,
                        "path": str(repo_path),
                        "status": "existing",
                        "url": repo_url,
                        "update_warning": update_result["error"]
                    }
            else:
                # Clone the repository
                clone_result = await self._clone_repository(repo_url, repo_path)
                if clone_result["success"]:
                    return {
                        "success": True,
                        "library": library,
                        "path": str(repo_path),
                        "status": "cloned",
                        "url": repo_url
                    }
                else:
                    return {
                        "success": False,
                        "library": library,
                        "error": clone_result["error"],
                        "url": repo_url
                    }

        except Exception as e:
            logger.error(f"Error managing repository {library}: {e}")
            return {
                "success": False,
                "library": library,
                "error": str(e)
            }

    async def _clone_repository(self, repo_url: str, target_path: Path) -> Dict[str, Any]:
        """Clone a git repository."""
        try:
            # Remove target if it exists but is not a valid git repo
            if target_path.exists():
                shutil.rmtree(target_path)

            logger.info(f"Cloning {repo_url} to {target_path}")

            cmd = ["git", "clone", "--depth", "1", repo_url, str(target_path)]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode == 0:
                logger.info(f"Successfully cloned repository to {target_path}")
                return {
                    "success": True,
                    "path": str(target_path),
                    "stdout": stdout.decode('utf-8'),
                    "stderr": stderr.decode('utf-8')
                }
            else:
                error_msg = stderr.decode('utf-8') if stderr else "Unknown git error"
                logger.error(f"Git clone failed: {error_msg}")
                return {
                    "success": False,
                    "error": f"Git clone failed: {error_msg}",
                    "stdout": stdout.decode('utf-8') if stdout else "",
                    "stderr": error_msg
                }

        except Exception as e:
            logger.error(f"Exception during git clone: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _update_repository(self, repo_path: Path) -> Dict[str, Any]:
        """Update an existing git repository."""
        try:
            logger.info(f"Updating repository at {repo_path}")

            cmd = ["git", "-C", str(repo_path), "pull", "origin", "main"]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode == 0:
                logger.info(f"Successfully updated repository at {repo_path}")
                return {
                    "success": True,
                    "path": str(repo_path),
                    "stdout": stdout.decode('utf-8'),
                    "stderr": stderr.decode('utf-8')
                }
            else:
                # Try master branch if main fails
                cmd_master = ["git", "-C", str(repo_path), "pull", "origin", "master"]
                process_master = await asyncio.create_subprocess_exec(
                    *cmd_master,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

                stdout_master, stderr_master = await process_master.communicate()

                if process_master.returncode == 0:
                    logger.info(f"Successfully updated repository using master branch")
                    return {
                        "success": True,
                        "path": str(repo_path),
                        "stdout": stdout_master.decode('utf-8'),
                        "stderr": stderr_master.decode('utf-8')
                    }
                else:
                    error_msg = stderr.decode('utf-8') if stderr else "Unknown git error"
                    logger.warning(f"Git pull failed: {error_msg}")
                    return {
                        "success": False,
                        "error": f"Git pull failed: {error_msg}",
                        "stdout": stdout.decode('utf-8') if stdout else "",
                        "stderr": error_msg
                    }

        except Exception as e:
            logger.error(f"Exception during git pull: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def create_session_workspace(self, session_id: str) -> Dict[str, Any]:
        """
        Create a workspace directory for a session.

        Args:
            session_id: Session identifier

        Returns:
            Dict with workspace information
        """
        try:
            session_dir = self.sessions_dir / f"session_{session_id}"
            session_dir.mkdir(parents=True, exist_ok=True)

            # Create metadata file
            metadata = {
                "session_id": session_id,
                "created_at": None,  # Will be set by caller
                "workspace_path": str(session_dir),
                "repositories_used": [],
                "tools_generated": []
            }

            metadata_file = session_dir / "metadata.json"
            async with aiofiles.open(metadata_file, 'w') as f:
                await f.write(json.dumps(metadata, indent=2))

            logger.info(f"Created session workspace: {session_dir}")
            return {
                "success": True,
                "session_id": session_id,
                "workspace_path": str(session_dir),
                "metadata_file": str(metadata_file)
            }

        except Exception as e:
            logger.error(f"Error creating session workspace {session_id}: {e}")
            return {
                "success": False,
                "session_id": session_id,
                "error": str(e)
            }

    async def cleanup_session_workspace(self, session_id: str) -> Dict[str, Any]:
        """
        Clean up a session workspace.

        Args:
            session_id: Session identifier

        Returns:
            Dict with cleanup result
        """
        try:
            session_dir = self.sessions_dir / f"session_{session_id}"

            if session_dir.exists():
                shutil.rmtree(session_dir)
                logger.info(f"Cleaned up session workspace: {session_dir}")
                return {
                    "success": True,
                    "session_id": session_id,
                    "message": "Workspace cleaned up successfully"
                }
            else:
                logger.info(f"Session workspace {session_id} does not exist")
                return {
                    "success": True,
                    "session_id": session_id,
                    "message": "Workspace did not exist"
                }

        except Exception as e:
            logger.error(f"Error cleaning up session workspace {session_id}: {e}")
            return {
                "success": False,
                "session_id": session_id,
                "error": str(e)
            }

    async def search_documentation(self, library: str, query: str) -> Dict[str, Any]:
        """
        Search documentation in a repository.

        Args:
            library: Library name
            query: Search query

        Returns:
            Dict with search results
        """
        try:
            # Ensure repository exists
            repo_result = await self.get_or_clone_repository(library)
            if not repo_result["success"]:
                return repo_result

            repo_path = Path(repo_result["path"])

            # Common documentation directories
            doc_dirs = ["docs", "doc", "documentation", "README.md", "*.rst", "*.md"]
            search_results = []

            for doc_pattern in doc_dirs:
                if doc_pattern.endswith('.md') or doc_pattern.endswith('.rst'):
                    # Search in files matching pattern
                    files = list(repo_path.glob(f"**/{doc_pattern}"))
                    for file_path in files[:10]:  # Limit results
                        if file_path.is_file():
                            result = await self._search_in_file(file_path, query)
                            if result["matches"]:
                                search_results.append(result)
                else:
                    # Search in directory
                    doc_dir = repo_path / doc_pattern
                    if doc_dir.exists() and doc_dir.is_dir():
                        dir_results = await self._search_in_directory(doc_dir, query)
                        search_results.extend(dir_results)

            return {
                "success": True,
                "library": library,
                "query": query,
                "repository_path": str(repo_path),
                "results": search_results[:20],  # Limit total results
                "total_found": len(search_results)
            }

        except Exception as e:
            logger.error(f"Error searching documentation for {library}: {e}")
            return {
                "success": False,
                "library": library,
                "query": query,
                "error": str(e)
            }

    async def _search_in_file(self, file_path: Path, query: str) -> Dict[str, Any]:
        """Search for query in a single file."""
        try:
            matches = []
            async with aiofiles.open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = await f.readlines()

            for line_num, line in enumerate(lines, 1):
                if query.lower() in line.lower():
                    matches.append({
                        "line_number": line_num,
                        "content": line.strip(),
                        "context": lines[max(0, line_num-2):line_num+2] if line_num > 1 else [line]
                    })

            return {
                "file_path": str(file_path),
                "relative_path": str(file_path.relative_to(file_path.parents[2])),
                "matches": matches[:5],  # Limit matches per file
                "total_matches": len(matches)
            }

        except Exception as e:
            logger.error(f"Error searching in file {file_path}: {e}")
            return {
                "file_path": str(file_path),
                "matches": [],
                "error": str(e)
            }

    async def _search_in_directory(self, dir_path: Path, query: str) -> List[Dict[str, Any]]:
        """Search for query in all files in a directory."""
        results = []
        try:
            # Search in common documentation file types
            file_patterns = ["*.md", "*.rst", "*.txt", "*.py"]

            for pattern in file_patterns:
                files = list(dir_path.glob(f"**/{pattern}"))
                for file_path in files[:20]:  # Limit files per pattern
                    if file_path.is_file():
                        result = await self._search_in_file(file_path, query)
                        if result["matches"]:
                            results.append(result)

        except Exception as e:
            logger.error(f"Error searching in directory {dir_path}: {e}")

        return results

    def get_workspace_info(self) -> Dict[str, Any]:
        """Get information about the workspace setup."""
        return {
            "project_root": str(PROJECT_ROOT),
            "workspaces_dir": str(WORKSPACES_DIR),
            "repos_dir": str(self.repos_dir),
            "sessions_dir": str(self.sessions_dir),
            "existing_repos": [d.name for d in self.repos_dir.iterdir() if d.is_dir()],
            "active_sessions": [d.name for d in self.sessions_dir.iterdir() if d.is_dir()]
        }


# Global instance
workspace_manager = WorkspaceManager()