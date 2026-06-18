import json
import os
import shutil

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
    
    # Load recipes
    recipes_file = os.path.join(uploader_dir, 'recipes.json')
    with open(recipes_file, 'r', encoding='utf-8') as f:
        recipes = json.load(f)
        
    # Process assets per recipe
    for recipe in recipes:
        recipe_id = recipe['id']
        
        # 1. Process Cover
        cover_path = recipe.get('coverUrl', '')
        if cover_path.startswith('assets/'):
            filename = cover_path.replace('assets/', '')
            src = os.path.join(asset_dir, filename)
            if os.path.exists(src):
                ext = os.path.splitext(filename)[1]
                new_filename = f"{recipe_id}{ext}"
                dst = os.path.join(covers_dir, new_filename)
                shutil.copy2(src, dst)
                recipe['coverUrl'] = f"public/images/covers/{new_filename}"
                print(f"Copied cover to {recipe['coverUrl']}")

        # 2. Process Tutorials
        if 'tutorials' in recipe and 'urls' in recipe['tutorials']:
            t_type = recipe['tutorials'].get('type', 'image')
            new_urls = []
            for idx, url in enumerate(recipe['tutorials']['urls']):
                if url.startswith('assets/'):
                    filename = url.replace('assets/', '')
                    src = os.path.join(asset_dir, filename)
                    if os.path.exists(src):
                        ext = os.path.splitext(filename)[1]
                        if t_type == 'video':
                            new_filename = f"{recipe_id}{ext}"
                            raw_dst = os.path.join(raw_videos_dir, new_filename)
                            compass_dst = os.path.join(compass_videos_dir, new_filename)
                            shutil.copy2(src, raw_dst)
                            shutil.copy2(src, compass_dst)
                            new_urls.append(f"public/videos/compass/{new_filename}")
                            print(f"Copied video to raw and compass for {recipe_id}")
                        else:
                            new_filename = f"{recipe_id}_{idx+1}{ext}"
                            dst = os.path.join(tutorials_dir, new_filename)
                            shutil.copy2(src, dst)
                            new_urls.append(f"public/images/tutorials/{new_filename}")
                            print(f"Copied tutorial image to {new_urls[-1]}")
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
                        ext = os.path.splitext(filename)[1]
                        if media_path.endswith('.mp4'):
                            new_filename = f"{recipe_id}_step_{idx+1}{ext}"
                            raw_dst = os.path.join(raw_videos_dir, new_filename)
                            compass_dst = os.path.join(compass_videos_dir, new_filename)
                            shutil.copy2(src, raw_dst)
                            shutil.copy2(src, compass_dst)
                            step['media'] = f"public/videos/compass/{new_filename}"
                        else:
                            new_filename = f"{recipe_id}_step_{idx+1}{ext}"
                            dst = os.path.join(tutorials_dir, new_filename)
                            shutil.copy2(src, dst)
                            step['media'] = f"public/images/tutorials/{new_filename}"
                        print(f"Copied step media to {step['media']}")
    
    # Generate public/data/recipes.json
    out_json = os.path.join(data_dir, 'recipes.json')
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(recipes, f, ensure_ascii=False, indent=2)
    print(f"Generated {out_json}")
    
    # Generate js/data.js (for frontend direct access without fetch)
    data_js_content = f"// Auto-generated from _uploader/recipes.json\nwindow.RECIPE_DATA = {json.dumps(recipes, ensure_ascii=False, indent=2)};\n"
    data_js_path = os.path.join(js_dir, 'data.js')
    with open(data_js_path, 'w', encoding='utf-8') as f:
        f.write(data_js_content)
    print(f"Generated {data_js_path}")

if __name__ == "__main__":
    main()
