#!/bin/bash
# thepufflette.co — hero image generator via kie.ai gpt-image-2-image-to-image
# Usage: KIE_API_KEY=xxxx bash scripts/gen-hero.sh
# (the key lives in the repo-root .env as KIE_API_KEY — never hardcode it here)

set -e

API_KEY="${KIE_API_KEY:?Set KIE_API_KEY in your environment (see ../.env)}"
BASE="https://api.kie.ai/api/v1"
OUT="public/heroes"
mkdir -p "$OUT"

# ── helpers ──────────────────────────────────────────────────────────────────

create_task() {
  local prompt="$1" url="$2" ratio="${3:-16:9}"
  curl -s -X POST "$BASE/jobs/createTask" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"gpt-image-2-image-to-image\",\"input\":{\"prompt\":\"$(echo "$prompt" | sed "s/\"/'/g")\",\"input_urls\":[\"$url\"],\"aspect_ratio\":\"$ratio\"}}"
}

poll_task() {
  local task_id="$1" label="$2"
  echo "  ⏳  [$label] polling $task_id …"
  while true; do
    resp=$(curl -s "$BASE/jobs/recordInfo?taskId=$task_id" \
      -H "Authorization: Bearer $API_KEY")
    state=$(python3 -c "import sys,json; print(json.loads('$resp')['data']['state'])" 2>/dev/null || echo "waiting")
    case "$state" in
      success)
        img_url=$(python3 -c "
import sys,json
d=json.loads('''$resp''')
rj=json.loads(d['data']['resultJson'])
print(rj['resultUrls'][0])
" 2>/dev/null)
        echo "  ✅  [$label] done → $img_url"
        echo "$img_url"
        return 0
        ;;
      fail)
        echo "  ❌  [$label] failed"
        return 1
        ;;
      *)
        prog=$(python3 -c "import sys,json; print(json.loads('$resp')['data'].get('progress',0))" 2>/dev/null || echo "?")
        echo "  …  [$label] $state (${prog}%) – waiting 8s"
        sleep 8
        ;;
    esac
  done
}

download() {
  local url="$1" name="$2"
  curl -sL "$url" -o "$OUT/$name"
  echo "  💾  saved → $OUT/$name"
}

# ── source images (product photos already in Supabase) ───────────────────────

IMG_BASE="https://chwxcfzqjxyorewehcwa.supabase.co/storage/v1/object/public/menu-images/47ae468f-8fb4-4803-9dce-675eb741f391"

LOTUS_MILKCAKE="$IMG_BASE/1778535403052-65tp76.jpg"
LOTUS_TUB="$IMG_BASE/1778535313270-19hepa.jpg"
CHOC_CHEESECAKE="$IMG_BASE/1778535492774-a80plw.jpg"
LOTUS_CHEESECAKE="$IMG_BASE/1778535458507-0orq2h.jpg"

# ── prompts ───────────────────────────────────────────────────────────────────

P1="Photorealistic editorial bakery hero photograph, 16:9 cinematic wide format. A soft pastel-toned milkcake sits on a marble slab in a bright airy kitchen. Natural diffuse window light from the left. Warm cream and blush tones. Shallow depth of field, soft bokeh background. No text, no logos, no watermarks. Ultra-high detail, commercial food photography."

P2="Photorealistic wide-angle food photography hero shot, 16:9. A beautiful layered cake tub dessert centered on a wooden board, surrounded by scattered lotus biscuits and petals. Soft warm studio lighting. Rich earthy caramel tones. Magazine-cover composition. Clean elegant background. No text, no logos."

P3="Photorealistic luxury bakery hero image, 16:9 wide. A rich chocolate cheesecake slice plated elegantly on a white ceramic plate. Dark moody backdrop with a single dramatic side light. Deep chocolate browns and cream highlights. Ultra-sharp detail on the cake layers. Commercial food photography, no text, no watermarks."

P4="Photorealistic bright lifestyle hero shot, 16:9. A Lotus Biscoff cheesecake beautifully presented on a pastel pink cake stand in a sunlit cafe setting. Warm golden hour light streaming from the side. Crumbled biscuits and caramel drizzle in the foreground. Airy editorial style, clean background. No text, no logos."

# ── submit all tasks ──────────────────────────────────────────────────────────

echo ""
echo "🥞  thepufflette.co — Hero Image Generation"
echo "==========================================="
echo ""

echo "Submitting task 1/4: milkcake hero …"
R1=$(create_task "$P1" "$LOTUS_MILKCAKE" "16:9")
T1=$(python3 -c "import json; print(json.loads('$R1')['data']['taskId'])" 2>/dev/null)
echo "  task id: $T1"

echo "Submitting task 2/4: cake tub hero …"
R2=$(create_task "$P2" "$LOTUS_TUB" "16:9")
T2=$(python3 -c "import json; print(json.loads('$R2')['data']['taskId'])" 2>/dev/null)
echo "  task id: $T2"

echo "Submitting task 3/4: cheesecake dark hero …"
R3=$(create_task "$P3" "$CHOC_CHEESECAKE" "16:9")
T3=$(python3 -c "import json; print(json.loads('$R3')['data']['taskId'])" 2>/dev/null)
echo "  task id: $T3"

echo "Submitting task 4/4: cheesecake lifestyle hero …"
R4=$(create_task "$P4" "$LOTUS_CHEESECAKE" "16:9")
T4=$(python3 -c "import json; print(json.loads('$R4')['data']['taskId'])" 2>/dev/null)
echo "  task id: $T4"

echo ""
echo "All submitted. Polling for results …"
echo ""

# ── poll & download ───────────────────────────────────────────────────────────

URL1=$(poll_task "$T1" "milkcake-hero")
[ -n "$URL1" ] && download "$URL1" "hero-milkcake.jpg"

URL2=$(poll_task "$T2" "tub-hero")
[ -n "$URL2" ] && download "$URL2" "hero-cake-tub.jpg"

URL3=$(poll_task "$T3" "cheesecake-dark")
[ -n "$URL3" ] && download "$URL3" "hero-cheesecake-dark.jpg"

URL4=$(poll_task "$T4" "cheesecake-lifestyle")
[ -n "$URL4" ] && download "$URL4" "hero-cheesecake-lifestyle.jpg"

echo ""
echo "✅  All done! Files saved to diamond-taste/$OUT/"
echo ""
ls -lh "$OUT/"
