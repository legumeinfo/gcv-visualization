export type EventBusSubscription = {
  unsubscribe: () => void
}


// basic implementation of a publish-subscribe eventbus
class EventBus {

  private _subscribers = [];

  subscribe(callback): EventBusSubscription {
    const index = this._subscribers.push(callback) - 1;

    return {
      unsubscribe: () => {
        delete this._subscribers[index];
      }
    }
  }

  publish(event): void {
    this._subscribers.forEach((callback) => callback(event));
  }
}


// singleton
export const eventBus = new EventBus();
