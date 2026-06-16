import os
import re
import html
import json
import time
import logging
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "cache.json"
CACHE_TTL = 3600  # Cache duration: 1 hour in seconds

def clean_html(raw_html):
    """Strips html tags, decodes entities, and cleans whitespace for plain text."""
    if not raw_html:
        return ""
    # Strip HTML tags
    clean_r = re.compile('<.*?>')
    clean_text = re.sub(clean_r, '', raw_html)
    # Decode HTML entities (e.g. &amp; -> &, &lt; -> <)
    clean_text = html.unescape(clean_text)
    # Normalize whitespaces
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()
    return clean_text

def parse_xml_feed(xml_content):
    """Parses BigQuery release notes Atom feed and splits entries into individual update items."""
    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        logger.error(f"Failed to parse XML string: {e}")
        return []

    # Namespace handling
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = root.findall('atom:entry', ns)
    if not entries:
        entries = root.findall('.//entry')
        
    items = []
    
    for entry in entries:
        title_el = entry.find('atom:title', ns) or entry.find('title')
        updated_el = entry.find('atom:updated', ns) or entry.find('updated')
        link_el = entry.find("atom:link[@rel='alternate']", ns)
        if link_el is None:
            link_el = entry.find("link[@rel='alternate']")
        if link_el is None:
            link_el = entry.find("atom:link", ns) or entry.find("link")
            
        content_el = entry.find('atom:content', ns) or entry.find('content')
        
        date = title_el.text.strip() if title_el is not None and title_el.text else "Unknown Date"
        iso_date_raw = updated_el.text.strip() if updated_el is not None and updated_el.text else ""
        iso_date = iso_date_raw[:10] if iso_date_raw else ""
        link_href = link_el.attrib.get('href', '') if link_el is not None else ""
        
        raw_content = content_el.text if content_el is not None and content_el.text else ""
        
        # Split content by <h3> headings (e.g., <h3>Feature</h3>, <h3>Issue</h3>)
        # BigQuery release notes partition updates inside the content block this way.
        h3_matches = list(re.finditer(r'<h3>(.*?)</h3>', raw_content, re.IGNORECASE))
        
        if not h3_matches:
            # Fallback if no specific <h3> types are parsed: return the entry as a single item
            text_only = clean_html(raw_content)
            items.append({
                'id': f"{iso_date}_0",
                'date': date,
                'iso_date': iso_date,
                'type': 'Update',
                'content': raw_content,
                'text_content': text_only,
                'link': link_href
            })
            continue
            
        for idx, match in enumerate(h3_matches):
            update_type = match.group(1).strip()
            
            # Extract content between this heading and the next (or end of content)
            start_pos = match.end()
            end_pos = h3_matches[idx + 1].start() if idx + 1 < len(h3_matches) else len(raw_content)
            update_content = raw_content[start_pos:end_pos].strip()
            
            text_only = clean_html(update_content)
            
            # Form clean sub-link if applicable
            fragment = date.replace(' ', '_').replace(',', '')
            item_link = link_href
            if link_href and '#' not in link_href:
                item_link = f"{link_href}#{fragment}"
                
            items.append({
                'id': f"{iso_date}_{idx}",
                'date': date,
                'iso_date': iso_date,
                'type': update_type,
                'content': update_content,
                'text_content': text_only,
                'link': item_link
            })
            
    return items

def fetch_and_cache(force=False):
    """Fetches the latest feed, updates cache, and returns parsed notes and source metadata."""
    now = time.time()
    
    # Check if cache is fresh and valid
    if not force and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
            cache_time = cached_data.get('fetched_at', 0)
            if now - cache_time < CACHE_TTL:
                logger.info("Serving from local cache")
                return cached_data
        except Exception as e:
            logger.warning(f"Error reading cache: {e}. Will fetch fresh data.")
            
    logger.info(f"Fetching fresh data from {FEED_URL}")
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        xml_content = response.text
        
        parsed_items = parse_xml_feed(xml_content)
        
        cache_data = {
            'fetched_at': now,
            'items': parsed_items
        }
        
        # Save to cache
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
        return cache_data
    except Exception as e:
        logger.error(f"Error fetching/parsing feed: {e}")
        # Return stale cache if available, else empty list
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return {'fetched_at': 0, 'items': [], 'error': str(e)}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    """Returns the parsed release notes, using cache if fresh."""
    data = fetch_and_cache(force=False)
    return jsonify(data)

@app.route('/api/refresh', methods=['POST'])
def force_refresh():
    """Forces an API refresh from the Google feed."""
    data = fetch_and_cache(force=True)
    return jsonify(data)

if __name__ == '__main__':
    # Default local dev port
    app.run(host='127.0.0.1', port=5000, debug=True)
