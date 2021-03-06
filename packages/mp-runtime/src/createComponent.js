import computeChangedData from './computeChangedData';
import deepCopy from './deepCopy';
import { registerComponent } from './componentsHub';
import { normalizeScopedSlots } from './normalizeScopedSlots';

/**
 * Returns a boolean indicating whether the object has the specified property as its own property.
 * @param {Object} object
 * @param {String} property
 */
function hasOwnProperty(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function getSlotName(item) {
  if (item && hasOwnProperty(item, 'props')) {
    return item.props.slot || 'default';
  } else {
    return 'default';
  }
}

function injectSlot(child, $slots) {
  if (null == child) return;
  const slotName = getSlotName(child);
  if (null == slotName) return;
  $slots[slotName] = $slots[slotName] || [];
  $slots[slotName].push(child);
}

// Count of component instance numbers.
let componentCount = 0;

export default function createComponent(renderFactory, render, config, componentPath, cssText) {
  const templateRender = renderFactory(render);
  const component = class extends render.Component {
    static contextTypes = {
      $page: null,
    };

    constructor(props, context) {
      super(props, context);
      if (context.$page && cssText && (cssText = String(cssText))) {
        const document = context.$page.vnode._document;
        const cssTextNode = document.createTextNode(cssText);
        const styleNode = document.createElement('style');
        styleNode.appendChild(cssTextNode);
        document.body.appendChild(styleNode);
      }
      /**
       * If not defined `data` field in config,
       * then default val will be an empty plain object,
       * else data will be deep copied.
       */
      this.state = hasOwnProperty(config, 'data')
        ? deepCopy(config.data)
        : {};
      this.publicInstance = this._createPublicInstance();
      this.componentId = ++componentCount;
    }

    static defaultProps = config.props;

    _createPublicInstance() {
      const scope = {};

      if (config.methods != null) {
        for (let key in config.methods) {
          if (hasOwnProperty(config.methods, key)) {
            scope[key] = config.methods[key].bind(scope);
          }
        }
      }

      Object.defineProperty(scope, 'props', {
        get: () => this.props,
      });
      Object.defineProperty(scope, 'data', {
        get: () => this.state,
      });

      Object.defineProperty(scope, 'setData', {
        get: () => this.setData,
      });

      Object.defineProperty(scope, '$slots', {
        get: () => this.transformChildrenToSlots(this.props.children),
      });

      Object.defineProperty(scope, '$scopedSlots', {
        get: () => normalizeScopedSlots(this.props.scopedSlots, scope.$slots),
      });

      Object.defineProperty(scope, 'is', {
        get: () => componentPath,
      });

      Object.defineProperty(scope, '$page', {
        get: () => this.context.$page,
      });

      Object.defineProperty(scope, '$id', {
        get: () => this.componentId,
      });

      return scope;
    }

    setData = (data, callback) => {
      if (data == null) return;
      this.setState(computeChangedData(this.state, data), callback);
    };

    transformChildrenToSlots = (children) => {
      const $slots = {};
      if (Array.isArray(children)) {
        for (let i = 0, l = children.length; i < l; i++) {
          injectSlot(children[i], $slots);
        }
      } else {
        injectSlot(children, $slots);
      }
      return $slots;
    };

    componentDidMount() {
      if (typeof config.didMount === 'function') {
        config.didMount.call(this.publicInstance);
      }
    }

    componentDidUpdate(prevProps, prevState) {
      if (typeof config.didUpdate === 'function') {
        config.didUpdate.call(this.publicInstance, prevProps, prevState);
      }
    }

    componentWillUnmount() {
      if (typeof config.didUnmount === 'function') {
        config.didUnmount.call(this.publicInstance);
      }
    }

    render() {
      const { $slots, $id, props, data } = this.publicInstance;
      return templateRender.call(this.publicInstance, {
        $id, $slots, ...props, ...data
      });
    }
  };

  if (componentPath !== undefined) {
    registerComponent(componentPath, component);
  }

  return component;
}
