export const formatSseEvent = (data: object, eventName?: string): string => {
  const jsonString = JSON.stringify(data);
  if (eventName) {
    return `event: ${eventName}\ndata: ${jsonString}\n\n`;
  }
  return `data: ${jsonString}\n\n`;
};
