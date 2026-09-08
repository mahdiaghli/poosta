from google.cloud import storage
import os

bucket_name = "dx-scin-public-data"
prefix = "dataset/images/"
output_dir = "scin_images"

os.makedirs(output_dir, exist_ok=True)

client = storage.Client.create_anonymous_client()
bucket = client.bucket(bucket_name)

blobs = client.list_blobs(bucket, prefix=prefix)

count = 0

for blob in blobs:
    filename = os.path.basename(blob.name)

    if not filename:
        continue

    output_path = os.path.join(output_dir, filename)

    blob.download_to_filename(output_path)

    count += 1
    print(f"[{count}] Downloaded: {filename}")

print(f"\nDone! {count} images downloaded.")
