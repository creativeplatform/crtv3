// app/components/Alerts/types.ts
export interface AlertProps {
  message: string;
//   title?: string; // Optional title for the alert
  dismissible?: boolean; // Optional property to make alerts dismissible
//   // Add other properties as needed
//   // For example, you might want to add a duration for auto-dismiss
  duration?: number; // Duration in milliseconds for auto-dismiss
//   // Add other properties as needed
//   // For example, you might want to add a callback function for when the alert is dismissed
  onDismiss?: () => void; // Callback function when the alert is dismissed
//   // Add other properties as needed
//   // For example, you might want to add a custom className for styling
  className?: string; // Custom class name for styling
//   // Add other properties as needed
//   // For example, you might want to add a custom style object for inline styles
  style?: React.CSSProperties; // Custom style object for inline styles
//   // Add other properties as needed
//   // For example, you might want to add a custom icon for the alert                  

  icon?: React.ReactNode; // Custom icon for the alert
//   // Add other properties as needed
//   // For example, you might want to add a custom animation for the alert
  animation?: string; // Custom animation for the alert
//   // Add other properties as needed
//   // For example, you might want to add a custom transition for the alert
  transition?: string; // Custom transition for the alert
//   // Add other properties as needed
//   // For example, you might want to add a custom z-index for the alert           

  zIndex?: number; // Custom z-index for the alert
//   // Add other properties as needed
//   // For example, you might want to add a custom position for the alert
  position?: 'top' | 'bottom' | 'left' | 'right'; // Custom position for the alert
//   // Add other properties as needed
//   // For example, you might want to add a custom animation duration for the alert
  animationDuration?: number; // Custom animation duration for the alert
//   // Add other properties as needed
//   // For example, you might want to add a custom transition duration for the alert
  transitionDuration?: number; // Custom transition duration for the alert
//   // Add other properties as needed
//   // For example, you might want to add a custom animation delay for the alert
  animationDelay?: number; // Custom animation delay for the alert
//   // Add other properties as needed
//   // For example, you might want to add a custom transition delay for the alert
  transitionDelay?: number; // Custom transition delay for the alert
//   // Add other properties as needed



}


// app/components/Alerts/Front-End/types.tsx (1-5)
export interface FrontEndAlertProps extends AlertProps {
  message: string;
  title?: string; // Optional title for the alert
  dismissible?: boolean; // Optional property to make alerts dismissible
}

// app/components/Alerts/Front-End/types.tsx (6-10)
export interface GraphQLAlertProps extends AlertProps {
  query: string;
  variables?: { [key: string]: any }; // Optional variables for the GraphQL query
  operationName?: string; // Optional name for the GraphQL operation
  onCompleted?: (data: any) => void; // Optional callback function to handle successful queries
  onError?: (error: Error) => void; // Optional callback function to handle errors during queries
}
