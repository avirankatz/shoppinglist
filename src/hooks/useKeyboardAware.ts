import { useEffect } from 'react'

// Delay to wait for keyboard animation on mobile devices
// Android Chrome and iOS Safari both animate the keyboard appearance
// which takes approximately 250-350ms. We use 300ms as a safe middle ground.
const KEYBOARD_ANIMATION_DELAY = 300

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
      // This delay is critical for Android Chrome which animates the keyboard
      setTimeout(() => {
        // Scroll input into view using the standard API
        // Using 'center' ensures the input is well-positioned in the visible area
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        })
        
        // Additional scroll adjustment for very small viewports
        // This helps when the keyboard takes up a large portion of the screen
        if (window.visualViewport && window.visualViewport.height < 400) {
          window.scrollBy(0, -50)
        }
      }, KEYBOARD_ANIMATION_DELAY)
    }

    // Listen to focus events on the entire document
    // Use capture phase to ensure we catch all events
    document.addEventListener('focusin', handleFocus, true)

    return () => {
      document.removeEventListener('focusin', handleFocus, true)
    }
  }, [])
}
