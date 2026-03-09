import re
import subprocess
import json

file_path = r'D:\AerohawX\src\components\admin\SimulationLibraryView.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract CK12 Physics Slugs
physics_slugs_match = re.search(r'const CK12_PHYSICS_SIMULATIONS: SimulationLink\[\] = \[(.*?)\]\.map', content, re.DOTALL)
physics_slugs = []
if physics_slugs_match:
    physics_slugs = re.findall(r'"([^"]+)"', physics_slugs_match.group(1))

# Extract CK12 Chemistry Slugs
chem_slugs_match = re.search(r'const CK12_CHEMISTRY_SIMULATIONS: SimulationLink\[\] = \[(.*?)\]\.map', content, re.DOTALL)
chem_slugs = []
if chem_slugs_match:
    chem_slugs = re.findall(r'"([^"]+)"', chem_slugs_match.group(1))

urls_to_check = []

for slug in physics_slugs:
    urls_to_check.append({
        'title': slug.replace('-', ' ').title(),
        'subject': 'Physics',
        'provider': 'CK-12 Simulations',
        'url': f'https://interactives.ck12.org/simulations/physics/{slug}/app/index.html'
    })

for slug in chem_slugs:
    urls_to_check.append({
        'title': slug.replace('-', ' ').title(),
        'subject': 'Chemistry',
        'provider': 'CK-12 Simulations',
        'url': f'https://interactives.ck12.org/simulations/chemistry/{slug}/app/index.html'
    })

# Extract from SIMULATION_LIBRARY
# This is a bit more complex. Let's find all objects with 'url' property.
# We'll use a regex to find blocks that look like SimulationLink objects.
sim_regex = re.compile(r'\{\s*title:\s*"([^"]+)",\s*provider:\s*"([^"]+)",\s*url:\s*"([^"]+)"', re.MULTILINE)

# We need to find which subject these belong to.
subject_blocks = re.split(r'subject:\s*"([^"]+)"', content)
# subject_blocks[0] is everything before first subject
# subject_blocks[1] is first subject name
# subject_blocks[2] is first subject content
# and so on

for i in range(1, len(subject_blocks), 2):
    subject = subject_blocks[i]
    block_content = subject_blocks[i+1]
    matches = sim_regex.findall(block_content)
    for title, provider, url in matches:
        urls_to_check.append({
            'title': title,
            'subject': subject,
            'provider': provider,
            'url': url
        })

# Some URLs are repeated or inside the CK12 spread, but our regex above might miss some if formatting is different.
# Let's check for any missed URLs in the file that look like simulation URLs.
all_urls = re.findall(r'url:\s*"([^"]+)"', content)
existing_urls = [u['url'] for u in urls_to_check]
for url in all_urls:
    if url not in existing_urls:
        # Try to find title/provider nearby
        # For simplicity, we'll just add it if missed.
        urls_to_check.append({
            'title': 'Unknown',
            'subject': 'Unknown',
            'provider': 'Unknown',
            'url': url
        })

print(f"Total URLs to check: {len(urls_to_check)}")

results = []

def check_url(url_info):
    url = url_info['url']
    try:
        # Use curl -I to get headers. -L to follow redirects. -s for silent. -m 10 for 10s timeout.
        result = subprocess.run(['curl', '-IsL', '-m', '10', url], capture_output=True, text=True)
        output = result.stdout
        if "HTTP/" in output:
            status_line = output.splitlines()[0]
            status_code = re.search(r'HTTP/\d\.\d\s+(\d+)', status_line)
            if status_code:
                code = int(status_code.group(1))
                return code
        return 0 # Unknown
    except Exception as e:
        return -1 # Error

# To avoid being too slow, we could use threads, but let's just do it sequentially for now or in batches if needed.
# Actually, let's use a simpler approach for the report.
for i, item in enumerate(urls_to_check):
    print(f"Checking {i+1}/{len(urls_to_check)}: {item['url']}")
    status = check_url(item)
    item['status'] = status
    results.append(item)

with open('audit_results.json', 'w') as f:
    json.dump(results, f, indent=2)

print("Audit complete. Results saved to audit_results.json")
