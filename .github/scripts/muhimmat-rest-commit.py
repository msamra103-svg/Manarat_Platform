"""Publish an already-tested, staged Git tree using SHA-verified REST operations."""
import base64, concurrent.futures, hashlib, json, os, subprocess, time
import urllib.request, urllib.error, threading
from pathlib import Path

PROJECT = "msamra103-svg/Manarat_Platform"
BASE = "e2333c9d2fcd8d2aa4860b2cfce73a558ad3eacd"
TARGET = "review/muhimmat-integrated-20261115"
API = f"https://api.github.com/repos/{PROJECT}"
HEADERS = {
    "Authorization": "Bearer " + os.environ["GH_TOKEN"],
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "abu-ubaida-release-review",
    "Content-Type": "application/json",
}
def git(*args):
    return subprocess.check_output(["git", *args]).decode().strip()
throttle = threading.Lock()
last_request = [0.0]
def request(method, endpoint, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    for attempt in range(7):
        with throttle:
            elapsed = time.monotonic() - last_request[0]
            if elapsed < 1.15:
                time.sleep(1.15 - elapsed)
            last_request[0] = time.monotonic()
        try:
            req = urllib.request.Request(API + endpoint, data=body, headers=HEADERS, method=method)
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")
            transient = exc.code in (429, 500, 502, 503, 504) or (exc.code == 403 and ("secondary rate limit" in body.lower() or "rate limit exceeded" in body.lower()))
            if not transient or attempt == 6:
                raise RuntimeError(f"GitHub REST {exc.code}: {body[:300]}") from exc
            delay = int(exc.headers.get("Retry-After", "0") or "0")
            time.sleep(max(delay, 75 if exc.code == 403 else 2 ** attempt))

changed = [p.decode() for p in subprocess.check_output(
    ["git", "diff", "--cached", "--name-only", "-z"]).split(b"\0") if p]
assert 10 < len(changed) < 350, len(changed)
assert all(Path(p).is_file() for p in changed), "Unexpected file deletion"

def upload_blob(path):
    data = Path(path).read_bytes()
    assert len(data) < 15_000_000, (path, len(data))
    digest = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
    uploaded = request("POST", "/git/blobs", {
        "content": base64.b64encode(data).decode(), "encoding": "base64"
    })
    assert uploaded["sha"] == digest, (path, uploaded["sha"], digest)
    return path

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for index, path in enumerate(pool.map(upload_blob, changed), 1):
        if index % 10 == 0:
            print(f"uploaded {index}/{len(changed)} immutable blobs", flush=True)

root_tree = git("write-tree")
folders = {""}
for path in changed:
    segments = path.split("/")
    for i in range(1, len(segments)):
        folders.add("/".join(segments[:i]))
new_trees = {}
for folder in sorted(folders, key=lambda p: (-p.count("/"), -len(p))):
    local_tree = git("rev-parse", root_tree + (":" + folder if folder else ""))
    items = []
    for row in subprocess.check_output(["git", "ls-tree", "-z", local_tree]).split(b"\0"):
        if not row:
            continue
        metadata, name = row.split(b"\t", 1)
        mode, obj_type, sha = metadata.decode().split(" ")
        child = name.decode()
        full = (folder + "/" if folder else "") + child
        if obj_type == "tree" and full in new_trees:
            sha = new_trees[full]
        items.append({"path": child, "mode": mode, "type": obj_type, "sha": sha})
    remote_tree = request("POST", "/git/trees", {"tree": items})["sha"]
    assert remote_tree == local_tree, (folder, remote_tree, local_tree)
    new_trees[folder] = remote_tree
    print("verified tree", folder or "<root>", flush=True)

assert new_trees[""] == root_tree
commit = request("POST", "/git/commits", {
    "message": "Integrate verified Mission of Knowledge with authoritative school assignments",
    "tree": root_tree,
    "parents": [BASE],
})
assert commit["tree"]["sha"] == root_tree
created = request("POST", "/git/refs", {
    "ref": "refs/heads/" + TARGET,
    "sha": commit["sha"],
})
assert created["object"]["sha"] == commit["sha"]
print("SUCCESS: reviewed integration branch", TARGET, commit["sha"], flush=True)
