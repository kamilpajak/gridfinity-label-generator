# Wymagania dla Batch Mode

## 🎯 Główny cel

Generowanie pojedynczego pliku PNG zawierającego wiele etykiet ułożonych poziomo (jedna obok drugiej) w formie "taśmy" z oznaczeniami do przycinania.

---

## 📋 Wymagania funkcjonalne

### 1. **Generowanie taśmy etykiet**

- Jeden plik PNG z wieloma etykietami
- Etykiety ułożone **poziomo** (w jednym rzędzie)
- Linie przerywane jako znaczniki cięcia między etykietami

### 2. **Zarządzanie etykietami**

- Dodawanie nowych etykiet do batch
- Usuwanie etykiet z batch
- Edycja treści poszczególnych etykiet
- Duplikowanie etykiet (szybkie tworzenie podobnych)
- Zmiana kolejności etykiet (opcjonalnie: drag & drop)

### 3. **Przełączanie trybu**

- Toggle/przycisk: Single Mode ↔ Batch Mode
- Zachowanie obecnej etykiety przy przejściu do batch mode

### 4. **Podgląd i export**

- Preview całej taśmy przed wygenerowaniem
- Przycisk "Export Batch" / "Generate Tape"
- Download pojedynczego pliku PNG

---

## 🎨 Wymagania wizualne

### 1. **Linie przycinania**

- **Lokalizacja**: Tylko **między etykietami** (nie na zewnętrznych brzegach)
  - Dla 3 etykiet = 2 linie przycinania
  - Dla 4 etykiet = 3 linie przycinania
- **Typ**: Pionowe linie przerywane
- **Kolor**: Szary (#999 lub #CCC) - wyraźny ale nie dominujący
- **Grubość**: 1-2px
- **Pattern**: 5-10px kreska + 5-10px odstęp
- **Wysokość**: Pełna wysokość etykiety

### 2. **Odstępy**

- **Gap między etykietami**: **1mm** (stała wartość)
- Linia przycinania znajduje się w środku tego gap'u

### 3. **Jakość druku**

- **Rozdzielczość**: 300 DPI minimum
- **Format**: PNG (bezstratny, dobry dla druku)
- **Nazwa pliku**: `batch_{timestamp}.png` (np. `batch_20250102_143052.png`)

---

## ⚙️ Wymagania techniczne

### 1. **Wymiary canvas**

```
Szerokość = (label_width + margin) × liczba_etykiet
Wysokość = label_height
```

### 2. **Limity**

- **Maksymalna liczba etykiet na taśmę**: **20 etykiet**
  - Wyświetlany progress: "5/20 labels" z progress barem
  - Zapobiega problemom z pamięcią
  - Możliwość tworzenia wielu taśm dla większych batch

### 3. **Ograniczenia wymiarów**

- ⚠️ **KRYTYCZNE**: Wszystkie etykiety w jednym batch muszą mieć **tę samą wysokość**
  - Dozwolone: batch z samymi etykietami 12mm
  - Dozwolone: batch z samymi etykietami 9mm
  - **NIEDOZWOLONE**: mieszanie 12mm i 9mm w jednym batch
- **Długości etykiet mogą się różnić** w ramach jednego batch
  - Każda etykieta może mieć inną długość (np. 35mm, 50mm, 70mm)
  - Długość zależy od Hardware Type i konfiguracji każdej etykiety
- **Wysokość wybierana raz dla całego batch**:
  - Przyciski 9mm/12mm umieszczone **nad listą etykiet**
  - Po wybraniu wysokości, **nie można jej zmienić** dla tego batch
  - Trzeba utworzyć nowy batch aby użyć innej wysokości

### 4. **Renderowanie**

- Każda etykieta renderowana osobno
- Składanie na jeden canvas
- Dodawanie linii przycinania między etykietami

---

## 💡 User Experience

### 1. **Workflow**

```
Single Mode → [Toggle Batch] → Batch Mode
                                    ↓
                         Wybór wysokości (9mm/12mm)
                                    ↓
                            Dodaj/edytuj etykiety
                                    ↓
                            Preview taśmy
                                    ↓
                            Export PNG
```

### 2. **Layout interface batch mode**

```
┌─────────────────────────────────────────────────────────────┐
│ [9mm] [12mm]  ←  Przyciski wysokości (dla całego batch)     │
│ Progress: ████████░░ 8/20 labels                            │
│ [+ Add Label]                                               │
├─────────────────────────────────────────────────────────────┤
│ Label #1: [Fastener ▾]  ←  Dropdown wyboru trybu           │
│ [Thread▾] [Length] [Standard▾] [Note] [QR] [Dup] [X]       │
├─────────────────────────────────────────────────────────────┤
│ Label #2: [General Item ▾]                                  │
│ [Primary] [Secondary] [Note] [QR] [Dup] [X]                │
├─────────────────────────────────────────────────────────────┤
│ Label #3: [Fastener ▾]                                      │
│ [Thread▾] [Length] [Standard▾] [Note] [QR] [Dup] [X]       │
├─────────────────────────────────────────────────────────────┤
│ PREVIEW:                                                    │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ [Label1]|[Label2]|[Label3]|[Label4] →              │    │
│ └─────────────────────────────────────────────────────┘    │
│ [Export Batch]                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. **Tryb etykiety (Fastener vs General Item)**

- Każda etykieta w batch może mieć **własny tryb**: Fastener lub General Item
- Dropdown/Toggle na początku każdego wiersza do wyboru trybu
- Zmiana trybu zmienia zestaw pól dostępnych w danym wierszu
- **Dozwolone**: mieszanie Fastener i General Item w jednym batch

### 4. **Konfiguracja pojedynczej etykiety - Fastener Mode**

Każdy wiersz zawiera (inline, bez modala):

- **Label Mode**: Dropdown (Fastener / General Item)
- **Measurement System**: Toggle (Metric / Imperial)
- **Thread Size**: Dropdown (M3, M5, M8, #4, #6, etc.)
- **Length**: Input number (disabled dla nuts/washers gdy standard wybrany)
- **ISO/DIN Standard**: Combobox z wyszukiwaniem
- **Optional Note**: Input text
- **QR Code**: Input text/URL (disabled dla 9mm)
- **Duplicate**: Przycisk duplikacji etykiety
- **Delete**: Przycisk usunięcia etykiety

### 5. **Konfiguracja pojedynczej etykiety - General Item Mode**

Każdy wiersz zawiera:

- **Label Mode**: Dropdown (Fastener / General Item)
- **Primary Text**: Input text
- **Secondary Text**: Input text
- **Optional Note**: Input text
- **QR Code**: Input text/URL (disabled dla 9mm)
- **Duplicate**: Przycisk duplikacji
- **Delete**: Przycisk usunięcia

### 6. **Preview taśmy**

- Umieszczony **pod wierszami** z konfiguracją etykiet
- **Tylko horizontal scroll** (prawo-lewo)
- Pokazuje rzeczywiste proporcje długości etykiet
- Aktualizuje się na żywo przy zmianach

### 7. **Persistence**

- **Auto-save do localStorage**: Stan batch zapisywany automatycznie przy każdej zmianie
- **Przejście Batch → Single**: Etykiety w batch są zachowane
- **Przejście Single → Batch**: Obecna etykieta staje się pierwszą w batch (jeśli batch jest pusty)
- **Odświeżenie strony**: Użytkownik wraca do swojego batch

---

## 🚀 Przyszłe rozszerzenia (nice-to-have)

1. **Import z pliku**
   - CSV/Excel import z wieloma etykietami
   - Mapowanie kolumn na pola etykiety

2. **Zapisywanie konfiguracji**
   - Zapis batch jako template
   - Szybkie ładowanie zapisanych batch

3. **Orientacja pionowa**
   - Opcja układu pionowego (etykiety jedna pod drugą)
   - Przydatne dla niektórych drukarek

4. **Customizacja linii**
   - Wybór koloru linii przycinania
   - Grubość i styl linii

---

## ✅ Definicja sukcesu

Batch mode będzie uznany za udany, gdy:

1. ✅ User może dodać wiele etykiet do batch
2. ✅ Wygenerowany PNG zawiera wszystkie etykiety w rzędzie
3. ✅ Linie przerywane są wyraźnie widoczne między etykietami
4. ✅ Wydrukowana taśma nadaje się do precyzyjnego cięcia
5. ✅ Proces jest intuicyjny i szybki
