# Language Rules for Free2Hang App

## 🌍 Language Policy

**The entire Free2Hang application must use English only.**

## Rules to Follow

### ✅ DO:
- Use English for all user-facing text
- Use English in error messages  
- Use English in notifications
- Use English in comments and documentation
- Use English placeholders in forms
- Use English button labels
- Use English navigation text

### ❌ DON'T:
- Use Estonian or any other language in UI
- Mix languages in the same component
- Use non-English text in alerts or popups
- Leave untranslated text from templates

## Examples

### ✅ Correct (English):
```javascript
Alert.alert('Error', 'Please check your email address');
placeholder="Enter your email address"
title: 'Welcome to Free2Hang!'
```

### ❌ Incorrect (Estonian):
```javascript
Alert.alert('Viga', 'Palun kontrollige oma e-posti aadressi');
placeholder="Sisestage oma e-posti aadress"
title: 'Tere tulemast Free2Hang'i!'
```

## Common English Phrases to Use

### Authentication:
- "Sign In" / "Sign Up" 
- "Email confirmation required"
- "Check your email"
- "Resend confirmation"
- "Welcome back!"

### Errors:
- "Error" / "Something went wrong"
- "Please try again"
- "Invalid email address"
- "Password too short"

### Actions:
- "Save" / "Cancel" / "Continue"
- "Back" / "Next" / "Done" 
- "Send" / "Resend" / "Submit"

### Navigation:
- "Home" / "Profile" / "Settings"
- "Back to sign in"
- "Go to dashboard"

## Validation Checklist

Before submitting any code, check:
- [ ] All user-visible text is in English
- [ ] Error messages are in English
- [ ] Alert dialogs use English
- [ ] Form placeholders are in English
- [ ] Button labels are in English
- [ ] Navigation text is in English
- [ ] Comments in code are in English

## Tools to Help

Use these tools to find non-English text:
```bash
# Search for common Estonian words
grep -r "esi\|aade\|lõp\|käi\|pälkko\|kiida\|kanne" . --exclude-dir=node_modules

# Search for Estonian characters
grep -r "ä\|ö\|ü\|õ" . --exclude-dir=node_modules --exclude="*.lock"
```

Remember: **English only for all user-facing content!** 🇺🇸 