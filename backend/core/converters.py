from bson import ObjectId
from datetime import datetime
from typing import Any, Dict, List, Union

def serialize_mongo_doc(data: Any) -> Any:
    """
    Recursively converts MongoDB documents (dicts or lists of dicts) 
    into JSON-serializable formats by handling ObjectIds and Datetimes.
    """
    if isinstance(data, list):
        return [serialize_mongo_doc(item) for item in data]
    
    if isinstance(data, dict):
        new_doc = {}
        for key, value in data.items():
            # Standard MongoDB _id to string 'id'
            if key == "_id" and isinstance(value, ObjectId):
                new_doc["id"] = str(value)
                continue
                
            # Handle other ObjectIds anywhere in the document
            if isinstance(value, ObjectId):
                new_doc[key] = str(value)
            # Handle Datetimes
            elif isinstance(value, datetime):
                new_doc[key] = value.isoformat()
            # Recurse into nested objects/lists
            elif isinstance(value, (dict, list)):
                new_doc[key] = serialize_mongo_doc(value)
            else:
                new_doc[key] = value
        return new_doc
        
    return data
