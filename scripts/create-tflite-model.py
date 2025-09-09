#!/usr/bin/env python3
"""
TFLite Model Oluşturucu
Basit bir mood detection modeli oluşturur.
"""

import tensorflow as tf
import numpy as np
import os

def create_simple_mood_model():
    """Basit bir mood detection modeli oluşturur"""
    
    # Model parametreleri
    input_shape = (5,)  # 5 özellik: heart_rate, steps, sleep_duration, activity_level, stress_level
    num_classes = 5     # 5 mood kategorisi: mutlu, normal, stresli, üzgün, endişeli
    
    # Model oluştur
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(32, activation='relu', input_shape=input_shape),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(16, activation='relu'),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(num_classes, activation='softmax')
    ])
    
    # Model derle
    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model

def train_model(model):
    """Modeli örnek verilerle eğitir"""
    
    # Örnek eğitim verisi oluştur
    np.random.seed(42)
    X_train = np.random.randn(1000, 5).astype(np.float32)
    
    # Normalizasyon (0-1 arası)
    X_train = (X_train - X_train.min()) / (X_train.max() - X_train.min())
    
    # Örnek etiketler oluştur (basit kurallar)
    y_train = np.zeros((1000, 5))
    
    for i in range(1000):
        # Basit kurallar ile mood kategorisi belirle
        heart_rate, steps, sleep, activity, stress = X_train[i]
        
        if heart_rate > 0.7 and activity > 0.6:
            y_train[i, 0] = 1  # mutlu
        elif stress > 0.7:
            y_train[i, 2] = 1  # stresli
        elif sleep < 0.3:
            y_train[i, 4] = 1  # endişeli
        elif steps < 0.3:
            y_train[i, 3] = 1  # üzgün
        else:
            y_train[i, 1] = 1  # normal
    
    # Modeli eğit
    model.fit(X_train, y_train, epochs=50, batch_size=32, verbose=0)
    
    return model

def convert_to_tflite(model, output_path):
    """Modeli TFLite formatına dönüştürür"""
    
    # TFLite converter oluştur
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    
    # Optimizasyonları etkinleştir
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    
    # Quantization (opsiyonel)
    converter.target_spec.supported_types = [tf.float16]
    
    # Dönüştür
    tflite_model = converter.convert()
    
    # Dosyaya kaydet
    with open(output_path, 'wb') as f:
        f.write(tflite_model)
    
    print(f"✅ TFLite modeli oluşturuldu: {output_path}")
    print(f"📊 Model boyutu: {len(tflite_model)} bytes")

def test_model(model):
    """Modeli test eder"""
    
    # Test verisi oluştur
    test_data = np.array([
        [0.8, 0.7, 0.6, 0.8, 0.2],  # mutlu
        [0.5, 0.5, 0.5, 0.5, 0.5],  # normal
        [0.3, 0.4, 0.2, 0.3, 0.9],  # stresli
    ]).astype(np.float32)
    
    # Tahmin yap
    predictions = model.predict(test_data, verbose=0)
    
    mood_categories = ['mutlu', 'normal', 'stresli', 'üzgün', 'endişeli']
    
    print("\n🧪 Model Test Sonuçları:")
    for i, pred in enumerate(predictions):
        predicted_class = np.argmax(pred)
        confidence = pred[predicted_class]
        print(f"Test {i+1}: {mood_categories[predicted_class]} (güven: {confidence:.2f})")

def main():
    """Ana fonksiyon"""
    
    print("🤖 TFLite Mood Detection Modeli Oluşturuluyor...")
    
    # Model oluştur
    model = create_simple_mood_model()
    print("✅ Model mimarisi oluşturuldu")
    
    # Modeli eğit
    model = train_model(model)
    print("✅ Model eğitildi")
    
    # Test et
    test_model(model)
    
    # TFLite'e dönüştür
    output_path = "assets/models/big_mood_detector/big_mood_detector.tflite"
    convert_to_tflite(model, output_path)
    
    print("\n🎉 TFLite modeli başarıyla oluşturuldu!")
    print("📁 Konum: assets/models/big_mood_detector/big_mood_detector.tflite")

if __name__ == "__main__":
    main()
