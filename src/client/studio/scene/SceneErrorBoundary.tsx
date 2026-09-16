import { Component, type ReactNode } from "react";
export class SceneErrorBoundary extends Component<{children:ReactNode;onPlan:()=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div className="studio-render-fallback" role="alert"><h2>The 3D view could not load.</h2><p>The floor plan and guest editor are still available. Export JSON to keep your work.</p><button onClick={this.props.onPlan}>Return to floor plan</button></div>:this.props.children;}
}
