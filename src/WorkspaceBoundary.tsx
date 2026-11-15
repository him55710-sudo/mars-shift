import {Component} from 'react';
import type {ReactNode} from 'react';
import {Orbit} from 'lucide-react';
export default class WorkspaceBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main className="workspace-error" role="alert"><Orbit size={30}/><h1>This view could not open.</h1><p>A required resource may be unavailable, or the application may have updated. Reload to try again.</p><div className="workspace-error-actions"><button onClick={()=>location.reload()}>Reload view</button><a href="/">Mission Hub</a></div></main>:this.props.children;}
}
