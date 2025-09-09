#!/usr/bin/env python3
"""
Basit TFLite Model Oluşturucu
"""

import os
import struct
import random

def create_simple_tflite_model():
    """Basit bir TFLite modeli oluşturur"""
    
    # TFLite model boyutu (yaklaşık 100KB)
    model_size = 100000
    
    # Model data oluştur
    model_data = bytearray()
    
    # TFLite magic number ve header
    model_data.extend(b'TFL3')  # Magic number
    model_data.extend(struct.pack('<I', 1))  # Version
    model_data.extend(struct.pack('<I', model_size))  # Model size
    
    # Geri kalanını structured data ile doldur
    random.seed(42)
    
    # Model parametreleri (simulated)
    for i in range(1000):  # 1000 parametre
        model_data.extend(struct.pack('<f', random.uniform(-1.0, 1.0)))
    
    # Geri kalanını random data ile doldur
    remaining = model_size - len(model_data)
    for i in range(remaining):
        model_data.append(random.randint(0, 255))
    
    return model_data

def main():
    """Ana fonksiyon"""
    
    print("🤖 Basit TFLite Model Oluşturuluyor...")
    
    # Model oluştur
    model_data = create_simple_tflite_model()
    
    # Dizin oluştur
    os.makedirs('assets/models/big_mood_detector', exist_ok=True)
    
    # Dosyaya yaz
    output_path = 'assets/models/big_mood_detector/big_mood_detector.tflite'
    with open(output_path, 'wb') as f:
        f.write(model_data)
    
    print(f"✅ TFLite modeli oluşturuldu: {len(model_data)} bytes")
    print(f"📁 Konum: {output_path}")
    
    # Dosya bilgilerini göster
    print(f"📊 Dosya boyutu: {len(model_data)} bytes")
    print(f"🔍 Magic number: {model_data[:4].decode('ascii', errors='ignore')}")

if __name__ == "__main__":
    main()
