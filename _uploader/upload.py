import json
import os
import shutil
from PIL import Image

def process_image(src, dst, max_size=1080):
    """Convert image to WebP and resize if it exceeds max_size."""
    try:
        with Image.open(src) as img:
            # Convert RGBA to RGB for webp if necessary
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Resize if needed
            width, height = img.size
            if max(width, height) > max_size:
                if width > height:
                    new_w = max_size
                    new_h = int(height * (max_size / width))
                else:
                    new_h = max_size
                    new_w = int(width * (max_size / height))
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            # Save as WebP
            img.save(dst, 'WEBP', quality=85)
            return True
    except Exception as e:
        print(f"Error processing image {src}: {e}")
        return False

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    uploader_dir = os.path.join(base_dir, '_uploader')
    asset_dir = os.path.join(uploader_dir, 'asset')
    
    # Define public paths
    public_dir = os.path.join(base_dir, 'public')
    data_dir = os.path.join(public_dir, 'data')
    covers_dir = os.path.join(public_dir, 'images', 'covers')
    tutorials_dir = os.path.join(public_dir, 'images', 'tutorials')
    raw_videos_dir = os.path.join(public_dir, 'videos', 'raw')
    compass_videos_dir = os.path.join(public_dir, 'videos', 'compass')
    
    # Create directories
    for d in [data_dir, covers_dir, tutorials_dir, raw_videos_dir, compass_videos_dir]:
        os.makedirs(d, exist_ok=True)
        
    js_dir = os.path.join(base_dir, 'js')
    os.makedirs(js_dir, exist_ok=True)
    
    # Load new recipes
    recipes_file = os.path.join(uploader_dir, 'recipes.json')
    with open(recipes_file, 'r', encoding='utf-8') as f:
        new_recipes = json.load(f)
        
    # Load existing recipes
    out_json = os.path.join(data_dir, 'recipes.json')
    existing_recipes = []
    if os.path.exists(out_json):
        with open(out_json, 'r', encoding='utf-8') as f:
            try:
                existing_recipes = json.load(f)
            except json.JSONDecodeError:
                pass
                
    # Process assets per new recipe
    for recipe in new_recipes:
        recipe_id = recipe['id']
        
        # 1. Process Cover (Convert to WebP, Max 1080px)
        cover_path = recipe.get('coverUrl', '')
        if cover_path.startswith('assets/'):
            filename = cover_path.replace('assets/', '')
            src = os.path.join(asset_dir, filename)
            if os.path.exists(src):
                new_filename = f"{recipe_id}.webp"
                dst = os.path.join(covers_dir, new_filename)
                if process_image(src, dst):
                    recipe['coverUrl'] = f"public/images/covers/{new_filename}"
                    print(f"Processed cover to {recipe['coverUrl']}")

        # 2. Process Tutorials (Images -> WebP inside ID folder)
        if 'tutorials' in recipe and 'urls' in recipe['tutorials']:
            t_type = recipe['tutorials'].get('type', 'image')
            new_urls = []
            for idx, url in enumerate(recipe['tutorials']['urls']):
                if url.startswith('assets/'):
                    filename = url.replace('assets/', '')
                    src = os.path.join(asset_dir, filename)
                    if os.path.exists(src):
                        if t_type == 'video':
                            ext = os.path.splitext(filename)[1]
                            new_filename = f"{recipe_id}{ext}"
                            raw_dst = os.path.join(raw_videos_dir, new_filename)
                            compass_dst = os.path.join(compass_videos_dir, new_filename)
                            shutil.copy2(src, raw_dst)
                            shutil.copy2(src, compass_dst)
                            new_urls.append(f"public/videos/compass/{new_filename}")
                            print(f"Copied video to raw and compass for {recipe_id}")
                        else:
                            # Create a subfolder for this recipe ID inside tutorials
                            recipe_tutorials_dir = os.path.join(tutorials_dir, recipe_id)
                            os.makedirs(recipe_tutorials_dir, exist_ok=True)
                            
                            new_filename = f"{idx+1}.webp"
                            dst = os.path.join(recipe_tutorials_dir, new_filename)
                            if process_image(src, dst):
                                new_urls.append(f"public/images/tutorials/{recipe_id}/{new_filename}")
                                print(f"Processed tutorial image to {new_urls[-1]}")
                    else:
                        new_urls.append(url)
                else:
                    new_urls.append(url)
            recipe['tutorials']['urls'] = new_urls

        # 3. Process Steps media (if any)
        if 'steps' in recipe:
            for idx, step in enumerate(recipe['steps']):
                media_path = step.get('media', '')
                if media_path.startswith('assets/'):
                    filename = media_path.replace('assets/', '')
                    src = os.path.join(asset_dir, filename)
                    if os.path.exists(src):
                        if media_path.endswith('.mp4'):
                            ext = os.path.splitext(filename)[1]
                            new_filename = f"{recipe_id}_step_{idx+1}{ext}"
                            raw_dst = os.path.join(raw_videos_dir, new_filename)
                            compass_dst = os.path.join(compass_videos_dir, new_filename)
                            shutil.copy2(src, raw_dst)
                            shutil.copy2(src, compass_dst)
                            step['media'] = f"public/videos/compass/{new_filename}"
                        else:
                            # Use the same recipe subfolder for step images
                            recipe_tutorials_dir = os.path.join(tutorials_dir, recipe_id)
                            os.makedirs(recipe_tutorials_dir, exist_ok=True)
                            
                            new_filename = f"step_{idx+1}.webp"
                            dst = os.path.join(recipe_tutorials_dir, new_filename)
                            if process_image(src, dst):
                                step['media'] = f"public/images/tutorials/{recipe_id}/{new_filename}"
                        print(f"Processed step media to {step['media']}")
    
        # Merge into existing_recipes
        found = False
        for i, existing in enumerate(existing_recipes):
            if existing['id'] == recipe_id:
                existing_recipes[i] = recipe
                found = True
                break
        if not found:
            existing_recipes.append(recipe)
            
    # Generate public/data/recipes.json
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(existing_recipes, f, ensure_ascii=False, indent=2)
    print(f"Generated {out_json}")
    
    # Generate js/data.js (for frontend direct access without fetch)
    data_js_content = f"// Auto-generated from public/data/recipes.json\nwindow.RECIPE_DATA = {json.dumps(existing_recipes, ensure_ascii=False, indent=2)};\n"
    data_js_path = os.path.join(js_dir, 'data.js')
    with open(data_js_path, 'w', encoding='utf-8') as f:
        f.write(data_js_content)
    print(f"Generated {data_js_path}")

if __name__ == "__main__":
    main()
