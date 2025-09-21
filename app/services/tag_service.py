from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text, or_

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
    
    def get_popular_tags_across_entities(
        self, db: Session, *, 
        entity_types: List[str] = None, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get most popular tags across specified entity types"""
        
        if not entity_types:
            entity_types = ["lab_result", "medication", "condition", "procedure", "immunization", "treatment", "encounter", "allergy"]
        
        # Build UNION query for all entity types
        union_queries = []
        for entity_type in entity_types:
            if entity_type in self.ENTITY_TABLES:
                table_name = self.ENTITY_TABLES[entity_type]
                union_queries.append(f"""
                    SELECT '{entity_type}' as entity_type, tag, COUNT(*) as usage_count
                    FROM {table_name}, jsonb_array_elements_text(tags) as tag
                    WHERE tags IS NOT NULL
                    GROUP BY tag
                """)
        
        if not union_queries:
            logger.warning("No valid entity types provided for tag popularity query", extra={
                "entity_types": entity_types
            })
            return []
        
        query = f"""
            WITH all_tags AS ({' UNION ALL '.join(union_queries)})
            SELECT tag, SUM(usage_count) as total_usage, 
                   array_agg(DISTINCT entity_type) as entity_types
            FROM all_tags
            GROUP BY tag
            ORDER BY total_usage DESC
            LIMIT :limit
        """
        
        try:
            result = db.execute(text(query), {"limit": limit}).fetchall()
            
            logger.info("Retrieved popular tags", extra={
                "entity_types": entity_types,
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
            logger.error("Failed to retrieve popular tags", extra={
                "entity_types": entity_types,
                "error": str(e)
            })
            raise
    
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
            if entity_type in self.ENTITY_TABLES:
                table_name = self.ENTITY_TABLES[entity_type]
                
                # Build tag filter conditions
                tag_conditions = []
                for tag in tags:
                    tag_conditions.append(f"tags @> '[\"{tag}\"]'")
                
                if tag_conditions:
                    query = f"""
                        SELECT * FROM {table_name}
                        WHERE {' OR '.join(tag_conditions)}
                        ORDER BY created_at DESC
                        LIMIT :limit
                    """
                    
                    try:
                        entity_results = db.execute(
                            text(query), 
                            {"limit": limit_per_entity}
                        ).fetchall()
                        
                        results[entity_type] = entity_results
                        
                        logger.debug("Retrieved records by tags", extra={
                            "entity_type": entity_type,
                            "tags": tags,
                            "result_count": len(entity_results)
                        })
                        
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
        """Get tag suggestions based on partial input"""
        
        # Search existing tags that start with the query across all entities
        union_queries = []
        for table_name in self.ENTITY_TABLES.values():
            union_queries.append(f"""
                SELECT DISTINCT tag
                FROM {table_name}, jsonb_array_elements_text(tags) as tag
                WHERE tag ILIKE :query || '%'
            """)
        
        if not union_queries:
            return []
        
        query_sql = f"""
            WITH all_matching_tags AS ({' UNION '.join(union_queries)})
            SELECT DISTINCT tag
            FROM all_matching_tags
            ORDER BY tag
            LIMIT :limit
        """
        
        try:
            result = db.execute(
                text(query_sql), 
                {"query": query.lower(), "limit": limit}
            ).fetchall()
            
            tags = [row[0] for row in result]
            
            logger.debug("Generated tag autocomplete suggestions", extra={
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


# Create singleton instance
tag_service = TagService()