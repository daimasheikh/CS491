import { Link } from 'react-router';

function About(props) {
  return (
    <div>
      <h2>About</h2>
      <Link to={props.pages.users} onClick={() => props.changePage("users")}>Go to Users</Link>
    </div>
  );
}

export default About;