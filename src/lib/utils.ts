import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// // cn : custom function takes multiple CSS class inputs (using clsx + twMerge) and combines them into a single, clean class string.
// // Example:
// // Instead of manually joining classes:
// className={`base-class ${isActive ? 'active' : ''} ${variant === 'primary' ? 'primary' : 'secondary'}`}

// // You can use cn():
// className={cn('base-class', isActive && 'active', variant === 'primary' ? 'primary' : 'secondary')}


// // Clean conditional styling:
// className={cn(
//   'button',           // always applied
//   loading && 'opacity-50',   // only if loading is true
//   disabled && 'cursor-not-allowed'  // only if disabled is true
// )}


// // Using clsx only
// <button className={clsx('btn', 'bg-blue-500', props.className)}>
//   // If props.className = 'bg-red-500', you get: 'btn bg-blue-500 bg-red-500'
//   // ❌ Both background colors applied!
// </button>

// // Using cn (clsx + twMerge)
// <button className={cn('btn', 'bg-blue-500', props.className)}>
//   // If props.className = 'bg-red-500', you get: 'btn bg-red-500'
//   // ✅ Only the override color is applied!
// </button>