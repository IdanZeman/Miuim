# 🎯 Tactical Delete Animation System

מערכת אנימציית מחיקה טקטית עם אפקט "scramble" דיגיטלי למראה צבאי-טכנולוגי.

## 📦 קבצים

- **`useTacticalDelete.tsx`** - Custom Hook לניהול הלוגיקה
- **`TacticalDeleteWrapper.tsx`** - Component Wrapper + Styles גלובליים

## 🚀 שימוש מהיר

### דוגמה פשוטה

```tsx
import { useTacticalDelete } from '@/hooks/useTacticalDelete';
import { TacticalDeleteStyles } from '@/components/ui/TacticalDeleteWrapper';

function MyComponent() {
  const [items, setItems] = useState([...]);

  // הגדרת ה-hook עם פונקציית המחיקה
  const { handleTacticalDelete, isAnimating } = useTacticalDelete<string>(
    async (itemId) => {
      // מחיקה מהשרת
      await supabase.from('my_table').delete().eq('id', itemId);
      
      // עדכון state מקומי
      setItems(prev => prev.filter(item => item.id !== itemId));
      
      showToast('נמחק בהצלחה!', 'success');
    },
    1300 // משך האנימציה (אופציונלי)
  );

  return (
    <>
      {items.map(item => (
        <div 
          key={item.id}
          className={isAnimating(item.id) ? 'tactical-delete-animation' : ''}
        >
          <p>{item.name}</p>
          <button onClick={() => handleTacticalDelete(item.id)}>
            <Trash />
          </button>
        </div>
      ))}
      
      {/* הוסף פעם אחת בקומפוננטה */}
      <TacticalDeleteStyles />
    </>
  );
}
```

## 📚 API

### `useTacticalDelete<T>(onDelete, animationDuration?)`

**פרמטרים:**
- `onDelete: (id: T) => Promise<void>` - פונקציית מחיקה אסינכרונית
- `animationDuration?: number` - משך האנימציה במילישניות (ברירת מחדל: 1300)

**מחזיר:**
```typescript
{
  handleTacticalDelete: (id: T) => Promise<void>,  // מפעיל את האנימציה והמחיקה
  isAnimating: (id: T) => boolean,                 // בודק אם פריט מסוים באנימציה
  isDeleting: boolean,                             // האם יש מחיקה בתהליך
  cancelAnimation: (id: T) => void,                // ביטול אנימציה (חירום)
  animatingIds: Set<T>                             // רשימת כל ה-IDs באנימציה
}
```

## 🎨 דוגמאות נוספות

### עם Error Handling

```tsx
const { handleTacticalDelete } = useTacticalDelete<string>(
  async (id) => {
    try {
      const { error } = await api.delete(id);
      if (error) throw error;
      
      setItems(prev => prev.filter(item => item.id !== id));
      showToast('נמחק!', 'success');
    } catch (err) {
      showToast('שגיאה במחיקה', 'error');
      // ה-hook ידאג לנקות את האנימציה
      throw err; // חשוב לזרוק שוב כדי שה-hook יתפוס
    }
  }
);
```

### עם משך אנימציה מותאם

```tsx
// אנימציה איטית יותר (2 שניות)
const { handleTacticalDelete } = useTacticalDelete(deleteFunc, 2000);

// אנימציה מהירה (0.8 שניות)
const { handleTacticalDelete } = useTacticalDelete(deleteFunc, 800);
```

### שימוש עם Wrapper Component

```tsx
import { TacticalDeleteWrapper } from '@/components/ui/TacticalDeleteWrapper';

<TacticalDeleteWrapper 
  isAnimating={isAnimating(item.id)}
  className="my-custom-class"
>
  <MyCard item={item} onDelete={() => handleTacticalDelete(item.id)} />
</TacticalDeleteWrapper>
```

## 🎬 תיאור האנימציה

1. **Phase 1 (1s)**: Scramble Effect
   - התחלה עם blur קל וגלואינג cyan
   - עליה הדרגתית של blur עם תנועת scale
   - מעבר דרך צבעים: cyan → amber → red
   - סיום בטשטוש מלא

2. **Phase 2 (0.3s)**: Collapse
   - קריסת גובה אלמנט
   - הסרת padding ו-margin
   - fade out סופי

## ⚙️ התאמה אישית

### שינוי צבעי הגלואינג

ערוך את `TacticalDeleteWrapper.tsx`:

```css
@keyframes tactical-scramble {
  40% {
    filter: blur(3px) drop-shadow(0 0 4px rgba(YOUR_COLOR));
  }
  /* ... */
}
```

### שינוי קצב האנימציה

```tsx
const { handleTacticalDelete } = useTacticalDelete(
  deleteFunc,
  2000  // 2 שניות במקום 1.3
);
```

### הוספת צלילים

```tsx
const { handleTacticalDelete } = useTacticalDelete(async (id) => {
  new Audio('/sounds/delete.mp3').play();
  await myDeleteFunction(id);
});
```

## 🛠️ טיפים

1. **Performance**: ה-hook משתמש ב-`useCallback` ו-`Set` לביצועים אופטימליים
2. **Accessibility**: הוסף `aria-live="polite"` למסכי תורים
3. **Mobile**: האנימציה עובדת מצוין על מובייל
4. **Multiple Deletes**: ה-hook תומך במחיקות מרובות במקביל

## 🐛 פתרון בעיות

**הפריט חוזר אחרי המחיקה:**
- ודא שאתה מעדכן את ה-state המקומי בתוך `onDelete`
- אל תקרא ל-`fetchData()` מחדש מיד אחרי המחיקה

**האנימציה לא רצה:**
- וודא ש-`TacticalDeleteStyles` מופיע בעץ הקומפוננטות
- בדוק שהקלאס `tactical-delete-animation` מתווסף נכון

**השגיאה לא נתפסת:**
- זרוק את השגיאה שוב בסוף ה-catch: `throw err`
