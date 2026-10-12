import { createContext, useContext } from "react";
import { Link } from "react-router-dom";

export const AdminNavigationContext = createContext(null);

export function AdminLink({ to, children, ...props }) {
  const navigation = useContext(AdminNavigationContext);
  if (!navigation) return <Link to={to} {...props}>{children}</Link>;
  return <Link to={to} {...props} onClick={(event) => {
    props.onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigation.open(to);
  }}>{children}</Link>;
}