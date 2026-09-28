import { Link } from 'react-router';

function Users(props) {
  return (
    <div>
      <h2>Users</h2>
      <ul>
        <li>Daima</li>
        
      </ul>
      <Link to={props.pages.home} onClick={() => props.changePage("home")}>Go to Home</Link>
    </div>
  );
}

export default Users;