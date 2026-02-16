import { useEffect } from 'react'

/**
 * Hook that ensures input fields are properly scrolled into view when the keyboard appears.
 * This prevents the keyboard from overlapping input fields on mobile devices.
 * 
 * The hook works by:
 * 1. Listening for focus events on input elements
 * 2. When an input is focused, scrolling it into view with appropriate padding
 * 3. Adjusting for the virtual keyboard using scrollIntoView with a slight delay
 */
export function useKeyboardAwareFocus(): void {
  useEffect(() => {
    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement
      
      // Only handle input and textarea elements
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        return
      }

      // Use a small delay to ensure the keyboard animation has started
      setTimeout(() => {
        // Scroll the input into view, accounting for the keyboard
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        })
      }, 300)
    }

    // Listen to focus events on the entire document
    document.addEventListener('focusin', handleFocus, true)

    return () => {
      document.removeEventListener('focusin', handleFocus, true)
    }
  }, [])
}
