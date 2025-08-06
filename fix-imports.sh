#!/bin/bash

echo "🔧 Import hatalarını düzeltiyorum..."

# Tüm dosyalarda olası src referanslarını düzelt
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .expo | while read file; do
  # Geçici dosya oluştur
  temp_file="${file}.tmp"
  
  # sed ile düzeltmeleri yap
  sed 's|../../src/|@/|g; s|../src/|@/|g; s|./src/|@/|g' "$file" > "$temp_file"
  
  # Eğer değişiklik varsa dosyayı güncelle
  if ! cmp -s "$file" "$temp_file"; then
    mv "$temp_file" "$file"
    echo "✓ Düzeltildi: $file"
  else
    rm "$temp_file"
  fi
done

echo "✅ Import düzeltmeleri tamamlandı" 