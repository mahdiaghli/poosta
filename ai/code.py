import torch
print(torch.cuda.is_available())      # باید True بشه
print(torch.cuda.device_count())     # معمولاً 1
print(torch.cuda.get_device_name(0)) # اسم کارتت رو نشون می‌ده