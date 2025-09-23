"""
Base Pydantic model utilities and configurations.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, ConfigDict


class BaseModelConfig(BaseModel):
    """Base model with common configuration."""

    model_config = ConfigDict(
        # Use enum values in JSON serialization
        use_enum_values=True,
        # Validate default values
        validate_default=True,
        # Allow extra fields for forward compatibility
        extra="forbid",
        # Timezone-aware datetime handling
        json_encoders={
            datetime: lambda v: v.replace(tzinfo=timezone.utc).isoformat()
        }
    )


class TimestampedModel(BaseModelConfig):
    """Base model with timestamp fields."""

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Creation timestamp"
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        description="Last update timestamp"
    )

    def update_timestamp(self) -> None:
        """Update the updated_at timestamp."""
        self.updated_at = datetime.now(timezone.utc)


class DatabaseModel(TimestampedModel):
    """Base model for database documents."""

    id: Optional[str] = Field(
        default=None,
        alias="_id",
        description="Database document ID"
    )

    model_config = ConfigDict(
        # Allow population by field name and alias
        populate_by_name=True,
        # Don't forbid extra fields for database models to handle MongoDB fields
        extra="ignore",
        # Use enum values
        use_enum_values=True,
        # Validate defaults
        validate_default=True
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary for database storage."""
        data = self.model_dump(by_alias=True, exclude_none=True)
        # Remove None id field for new documents
        if data.get("_id") is None:
            data.pop("_id", None)
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DatabaseModel":
        """Create model instance from database document."""
        return cls(**data)