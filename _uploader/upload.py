import json
import os
import shutil

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    uploader_dir = os.path.join(base_dir, '_uploader')
    public_assets_dir = os.path.join(base_dir, 'public', 'assets')
    js_dir = os.path.join(base_dir, 'js')
    
    os.makedirs(public_assets_dir, exist_ok=True)
    os.makedirs(js_dir, exist_ok=True)
    
    recipes_file = os.path.join(uploader_dir, 'recipes.json')
    with open(recipes_file, 'r', encoding='utf-8') as f:
        recipes = json.load(f)
        
    # Copy assets from _uploader/asset to public/assets
    asset_dir = os.path.join(uploader_dir, 'asset')
    if os.path.exists(asset_dir):
        for filename in os.listdir(asset_dir):
            src = os.path.join(asset_dir, filename)
            dst = os.path.join(public_assets_dir, filename)
            if os.path.isfile(src):
                shutil.copy2(src, dst)
                print(f"Copied {filename} to public/assets/")
    
    # Generate data.js
    data_js_content = f"// Auto-generated from _uploader/recipes.json\nwindow.RECIPE_DATA = {json.dumps(recipes, ensure_ascii=False, indent=2)};\n"
    data_js_path = os.path.join(js_dir, 'data.js')
    with open(data_js_path, 'w', encoding='utf-8') as f:
        f.write(data_js_content)
        
    print(f"Generated {data_js_path}")

if __name__ == "__main__":
    main()
