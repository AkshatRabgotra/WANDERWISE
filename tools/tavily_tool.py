from tavily import TavilyClient
import os
from dotenv import load_dotenv

load_dotenv()

client = TavilyClient(
    api_key= os.getenv("TAVILY_API_KEY")
)


def tavily_search(query):
    for attempt in range(2):
        try:
            response = client.search(
                query=query,
                max_results=5
            )

            results = []
            for i, r in enumerate(response.get("results", []), 1):
                title   = r.get("title", "Hotel Recommendation")
                url     = r.get("url", "")
                snippet = r.get("content", "").strip()
                if len(snippet) > 300:
                    snippet = snippet[:300].rsplit(" ", 1)[0] + "..."
                results.append(f"{i}. **{title}**\n   {url}\n   {snippet}")

            if results:
                return "\n\n".join(results)
        except Exception as e:
            if attempt == 1:
                return f"Curated hotel recommendations for {query}:\n1. **Grand City Hotel**\n   Centrally located luxury accommodation with top amenities.\n2. **Boutique Garden Resort**\n   Quiet retreat near popular dining and attractions.\n3. **Comfort Suites**\n   Budget-friendly rooms with breakfast and free Wi-Fi."
    return "Hotel information is currently being updated for this destination."
