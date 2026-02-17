import os
import re
import shutil

# Paths
posts_dir = "/Users/alexj/Documents/blog/content/about/"
attachments_dir = "/Users/alexj/Library/Mobile Documents/iCloud~md~obsidian/Documents/Dante/Blog/attachments/"
static_images_dir = "/Users/alexj/Documents/blog/static/images/"

# Step 1: Process each markdown file in the posts directory
for filename in os.listdir(posts_dir):
    if filename.endswith(".md"):
        filepath = os.path.join(posts_dir, filename)
        
        # NOTE: Your original code does not specify encoding.
        with open(filepath, "r") as file:
            content = file.read()
        
        # -----------------------------------------------------------------
        # Step 2: MODIFIED - Find all image links with ANY common extension
        # Matches: [[filename.png]], [[filename.jpg]], [[filename.svg]], etc.
        # Original: images = re.findall(r'\[\[([^]]*\.png)\]\]', content)
        images = re.findall(r'\[\[([^]]*\.(?:png|jpg|jpeg|gif|webp|svg))\]\]', content)
        # -----------------------------------------------------------------
        
        # Step 3: Replace image links and ensure URLs are correctly formatted
        for image in images:
            # Prepare the Markdown-compatible link with %20 replacing spaces
            markdown_image = f"![Image Description](/images/{image.replace(' ', '%20')})"
            # NOTE: This replacement will only target the [[...]] format, as per your original code.
            content = content.replace(f"![[{image}]]", markdown_image)
            
            # Step 4: Copy the image to the Hugo static/images directory if it exists
            image_source = os.path.join(attachments_dir, image)
            if os.path.exists(image_source):
                # NOTE: Your original code uses shutil.copy
                shutil.copy(image_source, static_images_dir)

        # Step 5: Write the updated content back to the markdown file
        # NOTE: Your original code does not specify encoding.
        with open(filepath, "w") as file:
            file.write(content)

print("Markdown files processed and images copied successfully.")