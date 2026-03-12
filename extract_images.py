import fitz
import os

pdf_file = "D:\\AerohawX\\CVpdf.pdf"
output_dir = "D:\\AerohawX\\cv_update"

doc = fitz.open(pdf_file)
img_count = 0

for page_index in range(len(doc)):
    page = doc[page_index]
    image_list = page.get_images(full=True)
    
    for img_index, img in enumerate(image_list, start=1):
        xref = img[0]
        base_image = doc.extract_image(xref)
        image_bytes = base_image["image"]
        image_ext = base_image["ext"]
        
        img_count += 1
        image_filename = os.path.join(output_dir, f"extracted_img_{img_count}.{image_ext}")
        
        with open(image_filename, "wb") as f:
            f.write(image_bytes)

print(f"Extracted {img_count} images.")
