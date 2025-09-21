from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from sqlalchemy.sql import quoted_name

from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


class TagService:
    """Universal tag management across all entities"""
    
    ENTITY_TABLES = {
        "lab_result": "lab_results",
        "medication": "medications", 
        "condition": "conditions",
        "procedure": "procedures",
        "immunization": "immunizations",
        "treatment": "treatments",
        "encounter": "encounters",
        "allergy": "allergies"
    }
    
    def _validate_entity_type(self, entity_type: str) -> str:
        """Validate and return table name for entity type to prevent SQL injection"""
        if entity_type not in self.ENTITY_TABLES:
            raise ValueError(f"Invalid entity type: {entity_type}")
        return self.ENTITY_TABLES[entity_type]
    
    def _validate_table_name(self, table_name: str) -> str:
        """Validate table name against allowed tables to prevent SQL injection"""
        allowed_tables = set(self.ENTITY_TABLES.values())
        if table_name not in allowed_tables:
            raise ValueError(f"Invalid table name: {table_name}")
        return table_name
    
    def get_popular_tags_across_entities(
        self, db: Session, *, 
        entity_types: List[str] = None, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get all user tags with their usage counts across entities"""
        
        if not entity_types:
            entity_types = ["lab_result", "medication", "condition", "procedure", "immunization", "treatment", "encounter", "allergy"]
        
        
        # Build subquery for usage counts across all entity types
        usage_subqueries = []
        query_params = {}
        
        for entity_type in entity_types:
            try:
                # Validate entity type and get safe table name
                table_name = self._validate_entity_type(entity_type)
                
                # Validate the table name is in our allowed list
                self._validate_table_name(table_name)
                
                # Since we've validated the table name against our whitelist, it's safe to use
                # We use parameterized queries for the entity_type value
                param_key = f"entity_type_{len(usage_subqueries)}"
                query_params[param_key] = entity_type
                
                usage_subqueries.append(f"""
                    SELECT tag, COUNT(*) as usage_count, :{param_key} as entity_type
                    FROM "{table_name}", jsonb_array_elements_text(tags) as tag
                    WHERE tags IS NOT NULL
                    GROUP BY tag
                """)
            except ValueError as e:
                logger.warning("Invalid entity type in tag search", extra={
                    "entity_type": entity_type,
                    "error": str(e)
                })
                continue
        
        if not usage_subqueries:
            # If no entity tables, just return user tags with 0 usage
            query = """
                SELECT tag, 0 as usage_count, ARRAY[]::text[] as entity_types
                FROM user_tags
                ORDER BY tag ASC
                LIMIT :limit
            """
        else:
            # Get all user tags and their usage counts
            query = f"""
                WITH usage_stats AS (
                    {' UNION ALL '.join(usage_subqueries)}
                )
                SELECT 
                    ut.tag,
                    COALESCE(SUM(us.usage_count), 0) as total_usage,
                    CASE 
                        WHEN COUNT(us.entity_type) > 0 
                        THEN array_agg(DISTINCT us.entity_type)
                        ELSE ARRAY[]::text[]
                    END as entity_types
                FROM user_tags ut
                LEFT JOIN usage_stats us ON ut.tag = us.tag
                GROUP BY ut.tag
                ORDER BY total_usage DESC, ut.tag ASC
                LIMIT :limit
            """
        
        try:
            # Combine limit parameter with entity type parameters
            final_params = {"limit": limit, **query_params}
            result = db.execute(text(query), final_params).fetchall()
            
            logger.info("Retrieved user tags with usage counts", extra={
                "tag_count": len(result),
                "limit": limit
            })
            
            return [
                {
                    "tag": row[0],
                    "usage_count": row[1],
                    "entity_types": row[2]
                }
                for row in result
            ]
        except Exception as e:
            logger.error("Failed to retrieve user tags", extra={
                "error": str(e)
            })
            # Fallback to empty list if user_tags table doesn't exist yet
            return []
    
    def search_across_entities_by_tags(
        self, db: Session, *,
        tags: List[str],
        entity_types: List[str] = None,
        limit_per_entity: int = 10
    ) -> Dict[str, List[Any]]:
        """Search for records across entity types by tags"""
        
        if not entity_types:
            entity_types = ["lab_result", "medication", "condition", "procedure", "immunization", "treatment", "encounter", "allergy"]
        
        results = {}
        
        for entity_type in entity_types:
            try:
                # Validate entity type and get safe table name
                table_name = self._validate_entity_type(entity_type)
                self._validate_table_name(table_name)
                
                # Build tag filter conditions using parameterized queries
                tag_conditions = []
                query_params = {"limit": limit_per_entity}
                
                for i, tag in enumerate(tags):
                    # Validate tag input to prevent injection
                    if not isinstance(tag, str) or len(tag) > 100:
                        logger.warning("Invalid tag in search", extra={
                            "tag": tag,
                            "entity_type": entity_type
                        })
                        continue
                    
                    param_key = f"tag_{i}"
                    query_params[param_key] = f'["{tag}"]'
                    tag_conditions.append(f"tags @> :{param_key}")
                
                if tag_conditions:
                    query = f"""
                        SELECT * FROM "{table_name}"
                        WHERE {' OR '.join(tag_conditions)}
                        ORDER BY created_at DESC
                        LIMIT :limit
                    """
                    
                    entity_results = db.execute(
                        text(query), 
                        query_params
                    ).fetchall()
                    
                    results[entity_type] = entity_results
                    
                    logger.debug("Retrieved records by tags", extra={
                        "entity_type": entity_type,
                        "tags": tags,
                        "result_count": len(entity_results)
                    })
                else:
                    results[entity_type] = []
                        
            except ValueError as e:
                logger.error("Invalid entity type in tag search", extra={
                    "entity_type": entity_type,
                    "error": str(e)
                })
                results[entity_type] = []
            except Exception as e:
                logger.error("Failed to search entity by tags", extra={
                    "entity_type": entity_type,
                    "tags": tags,
                    "error": str(e)
                })
                results[entity_type] = []
        
        logger.info("Completed cross-entity tag search", extra={
            "tags": tags,
            "entity_types": entity_types,
            "total_results": sum(len(r) for r in results.values())
        })
        
        return results
    
    def autocomplete_tags(self, db: Session, *, query: str, limit: int = 10) -> List[str]:
        """Get tag suggestions based on partial input from user tags"""
        
        try:
            
            # Search user tags that match the query
            query_sql = """
                SELECT DISTINCT tag
                FROM user_tags
                WHERE tag ILIKE :query || '%'
                ORDER BY tag
                LIMIT :limit
            """
            
            result = db.execute(
                text(query_sql), 
                {"query": query.lower(), "limit": limit}
            ).fetchall()
            
            tags = [row[0] for row in result]
            
            logger.debug("Generated tag autocomplete suggestions from user tags", extra={
                "query": query,
                "suggestion_count": len(tags)
            })
            
            return tags
            
        except Exception as e:
            logger.error("Failed to generate tag autocomplete", extra={
                "query": query,
                "error": str(e)
            })
            return []
    
    def rename_tag_across_entities(self, db: Session, *, old_tag: str, new_tag: str) -> int:
        """Rename a tag across all entity types"""
        
        total_updated = 0
        
        for table_name in self.ENTITY_TABLES.values():
            try:
                # Validate table name for security
                self._validate_table_name(table_name)
                
                # Update records that contain the old tag
                query = f"""
                    UPDATE "{table_name}"
                    SET tags = (
                        SELECT jsonb_agg(
                            CASE 
                                WHEN tag_element = :old_tag THEN :new_tag
                                ELSE tag_element
                            END
                        )
                        FROM jsonb_array_elements_text(tags) AS tag_element
                    )
                    WHERE tags @> :old_tag_json
                """
                
                result = db.execute(
                    text(query),
                    {
                        "old_tag": old_tag,
                        "new_tag": new_tag,
                        "old_tag_json": f'["{old_tag}"]'
                    }
                )
                
                updated_count = result.rowcount
                total_updated += updated_count
                
                logger.debug(f"Updated {updated_count} records in {table_name}", extra={
                    "table": table_name,
                    "old_tag": old_tag,
                    "new_tag": new_tag,
                    "updated_count": updated_count
                })
                
            except Exception as e:
                logger.error(f"Failed to rename tag in {table_name}", extra={
                    "table": table_name,
                    "old_tag": old_tag,
                    "new_tag": new_tag,
                    "error": str(e)
                })
        
        db.commit()
        
        logger.info("Completed tag rename across entities", extra={
            "old_tag": old_tag,
            "new_tag": new_tag,
            "total_updated": total_updated
        })
        
        return total_updated
    
    def delete_tag_across_entities(self, db: Session, *, tag: str) -> int:
        """Delete a tag from all entity types"""
        
        total_updated = 0
        
        for table_name in self.ENTITY_TABLES.values():
            try:
                # Validate table name for security
                self._validate_table_name(table_name)
                
                # Remove the tag from records that contain it
                query = f"""
                    UPDATE "{table_name}"
                    SET tags = (
                        SELECT jsonb_agg(tag_element)
                        FROM jsonb_array_elements_text(tags) AS tag_element
                        WHERE tag_element != :tag
                    )
                    WHERE tags @> :tag_json
                """
                
                result = db.execute(
                    text(query),
                    {
                        "tag": tag,
                        "tag_json": f'["{tag}"]'
                    }
                )
                
                updated_count = result.rowcount
                total_updated += updated_count
                
                logger.debug(f"Removed tag from {updated_count} records in {table_name}", extra={
                    "table": table_name,
                    "tag": tag,
                    "updated_count": updated_count
                })
                
            except Exception as e:
                logger.error(f"Failed to delete tag from {table_name}", extra={
                    "table": table_name,
                    "tag": tag,
                    "error": str(e)
                })
        
        db.commit()
        
        logger.info("Completed tag deletion across entities", extra={
            "tag": tag,
            "total_updated": total_updated
        })
        
        return total_updated
    
    def replace_tag_across_entities(self, db: Session, *, old_tag: str, new_tag: str) -> int:
        """Replace one tag with another across all entity types"""
        
        total_updated = 0
        
        for table_name in self.ENTITY_TABLES.values():
            try:
                # Validate table name for security
                self._validate_table_name(table_name)
                
                # Replace old tag with new tag, avoiding duplicates
                query = f"""
                    UPDATE "{table_name}"
                    SET tags = (
                        SELECT jsonb_agg(DISTINCT tag_element ORDER BY tag_element)
                        FROM (
                            SELECT 
                                CASE 
                                    WHEN tag_element = :old_tag THEN :new_tag
                                    ELSE tag_element
                                END AS tag_element
                            FROM jsonb_array_elements_text(tags) AS tag_element
                        ) AS updated_tags
                    )
                    WHERE tags @> :old_tag_json
                """
                
                result = db.execute(
                    text(query),
                    {
                        "old_tag": old_tag,
                        "new_tag": new_tag,
                        "old_tag_json": f'["{old_tag}"]'
                    }
                )
                
                updated_count = result.rowcount
                total_updated += updated_count
                
                logger.debug(f"Replaced tag in {updated_count} records in {table_name}", extra={
                    "table": table_name,
                    "old_tag": old_tag,
                    "new_tag": new_tag,
                    "updated_count": updated_count
                })
                
            except Exception as e:
                logger.error(f"Failed to replace tag in {table_name}", extra={
                    "table": table_name,
                    "old_tag": old_tag,
                    "new_tag": new_tag,
                    "error": str(e)
                })
        
        db.commit()
        
        logger.info("Completed tag replacement across entities", extra={
            "old_tag": old_tag,
            "new_tag": new_tag,
            "total_updated": total_updated
        })
        
        return total_updated
    
    def create_tag(self, db: Session, *, tag: str, user_id: int) -> bool:
        """Create a new tag in the tags registry table"""
        
        try:
            
            # Check if tag already exists for this user
            existing_query = """
                SELECT COUNT(*) FROM user_tags 
                WHERE user_id = :user_id AND tag = :tag
            """
            
            result = db.execute(
                text(existing_query),
                {"user_id": user_id, "tag": tag}
            ).fetchone()
            
            if result[0] > 0:
                logger.info("Tag already exists for user", extra={
                    "tag": tag,
                    "user_id": user_id
                })
                return True
            
            # Insert the new tag
            insert_query = """
                INSERT INTO user_tags (user_id, tag, created_at)
                VALUES (:user_id, :tag, CURRENT_TIMESTAMP)
            """
            
            db.execute(
                text(insert_query),
                {
                    "user_id": user_id,
                    "tag": tag
                }
            )
            
            db.commit()
            
            logger.info("Tag created successfully", extra={
                "tag": tag,
                "user_id": user_id
            })
            
            return True
            
        except Exception as e:
            logger.error("Failed to create tag", extra={
                "tag": tag,
                "user_id": user_id,
                "error": str(e)
            })
            db.rollback()
            raise
    
    def sync_tags_from_records(self, db: Session, *, user_id: int) -> int:
        """Sync all tags from medical records into the user_tags table"""
        
        try:
            
            # Get all unique tags used in this user's medical records
            union_queries = []
            for table_name in self.ENTITY_TABLES.values():
                # Validate table name for security
                self._validate_table_name(table_name)
                
                union_queries.append(f"""
                    SELECT DISTINCT tag
                    FROM "{table_name}" r
                    JOIN patients p ON r.patient_id = p.id
                    JOIN users u ON p.user_id = u.id,
                    jsonb_array_elements_text(r.tags) as tag
                    WHERE r.tags IS NOT NULL AND u.id = :user_id
                """)
            
            if not union_queries:
                return 0
            
            # Insert all found tags into user_tags (ignore duplicates)
            sync_query = f"""
                INSERT INTO user_tags (user_id, tag, created_at)
                SELECT DISTINCT :user_id, tag, CURRENT_TIMESTAMP
                FROM (
                    {' UNION '.join(union_queries)}
                ) all_user_tags
                ON CONFLICT (user_id, tag) DO NOTHING
            """
            
            result = db.execute(text(sync_query), {"user_id": user_id})
            synced_count = result.rowcount
            
            db.commit()
            
            logger.info("Synced tags from medical records", extra={
                "user_id": user_id,
                "synced_count": synced_count
            })
            
            return synced_count
            
        except Exception as e:
            logger.error("Failed to sync tags from medical records", extra={
                "user_id": user_id,
                "error": str(e)
            })
            db.rollback()
            return 0


# Create singleton instance
tag_service = TagService()